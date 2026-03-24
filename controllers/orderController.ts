import { Response, Request } from 'express';
import { AuthRequest } from '../types';
import Order from '../models/Order';
import Bicycle from '../models/Bicycle';
import User from '../models/User';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import { getOrCreateWallet } from './walletController';
import { ORDER_TIMEOUTS, FEE_CONFIG } from '../types/order';
import { calculateShippingFee } from '../services/shippingService';
import { createPaymentUrl, verifyReturnUrl, getResponseMessage } from '../services/vnpayService';
import { sendToUser } from '../services/pushNotificationService';
import * as notificationService from '../services/notificationService';

const generateCode = (prefix: string) => {
    const d = new Date().toISOString().replace(/-/g, '');
    return `${prefix}-${d}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
};


export const createOrder = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const buyer = req.user!;
        const { bicycleId, paymentType, shippingAddressId, discountPercent = 0, discountReason = '' } = req.body;

        const bicycle = await Bicycle.findById(bicycleId);
        if (!bicycle || bicycle.status != 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Xe đạp không khả dụng' });
        }

        if (bicycle.seller._id.toString() === buyer._id.toString()) {
            return res.status(400).json({ success: false, message: 'Không thể mua xe đạp của chính bạn' });
        }

        const seller = await User.findById(bicycle.seller._id);
        if (!seller) {
            return res.status(400).json({ success: false, message: 'Không tìm thấy người bán' });
        }
        // ktra có ng đặt chưa (ko đặt trùng)
        const existing = await Order.findOne({
            'bicycle._id': bicycleId,
            status: {
                $nin: ['COMPLETED', 'FUNDS_RELEASED', 'CANCELLED', 'CANCELLED_BY_BUYER', 'DEPOSIT_EXPIRED', 'REJECTED', 'PAYMENT_TIMEOUT']
            }
        });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Xe đạp đã được đặt hoặc đang chờ thanh toán' });
        }

        // Shipping address
        const buyerDoc = await User.findById(buyer._id);
        const shippingAddr = buyerDoc?.addresses?.find(
            (a: any) => a._id.toString() === shippingAddressId
        );
        if (!shippingAddr || !shippingAddr.districtId || !shippingAddr.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ giao hàng không hợp lệ hoặc thiếu mã quận/phường'
            });
        }

        // Pickup address must come from bicycle.location
        if (!bicycle.location?.districtId || !bicycle.location?.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ lấy hàng xe đạp thiếu mã quận/phường GHN'
            });
        }

        const pickupAddr = {
            provinceId: bicycle.location.provinceId,
            districtId: bicycle.location.districtId,
            wardCode: bicycle.location.wardCode,
            provinceName: bicycle.location.provinceName,
            districtName: bicycle.location.districtName,
            wardName: bicycle.location.wardName,
            street: bicycle.location.street,
            fullAddress: bicycle.location.fullAddress,
            coordinates: bicycle.location.coordinates,
        };

        const originalPrice = bicycle.price;
        const discountAmount = Math.round(originalPrice * discountPercent / 100);
        const finalPrice = originalPrice - discountAmount;

        let shippingFee = 0;
        try {
            const shippingResult = await calculateShippingFee({
                fromDistrictId: bicycle.location.districtId,
                fromWardCode: bicycle.location.wardCode,
                toDistrictId: shippingAddr.districtId,
                toWardCode: shippingAddr.wardCode,
                weight: 15000,
                insuranceValue: finalPrice,
            });
            shippingFee = shippingResult.total;
        } catch (err) {
            console.error('GHN API Error:', err);
            shippingFee = 30000;
        }

        const total = finalPrice + shippingFee;
        const deposit = Math.round(total * FEE_CONFIG.DEPOSIT_PERCENT);

        const now = new Date();
        const status = paymentType === 'FULL_100' ? 'RESERVED_FULL' : 'RESERVED_DEPOSIT';
        const timeout = paymentType === 'FULL_100' ? ORDER_TIMEOUTS.FULL_PAYMENT : ORDER_TIMEOUTS.DEPOSIT_RESERVATION;
        const primaryImage = bicycle.images?.find(img => img.isPrimary)?.url || bicycle.images?.[0]?.url;
        const order = new Order({
            orderCode: generateCode('ORD'),
            status,
            paymentType,
            buyer: {
                _id: buyer._id,
                fullName: buyer.fullName || '',
                phone: buyer.phone,
                email: buyer.email,
            },
            seller: {
                _id: seller._id,
                fullName: seller.fullName || '',
                phone: seller.phone,
            },
            shippingAddress: {
                provinceId: shippingAddr.provinceId,
                districtId: shippingAddr.districtId,
                wardCode: shippingAddr.wardCode,
                provinceName: shippingAddr.provinceName,
                districtName: shippingAddr.districtName,
                wardName: shippingAddr.wardName,
                street: shippingAddr.street,
                fullAddress: shippingAddr.fullAddress,
            },
            pickupAddress: pickupAddr,
            bicycle: {
                _id: bicycle._id,
                title: bicycle.title,
                price: bicycle.price,
                primaryImage,
                condition: bicycle.condition,
            },
            amounts: {
                total,
                deposit,
                shippingFee,
                pricing: {
                    originalPrice,
                    discountAmount,
                    discountPercent,
                    discountReason,
                    finalPrice,
                },
                depositPaid: 0,
                remainingPaid: 0,
                escrowAmount: 0,
                releasedAmount: 0,
            },
            transactions: [],
            reservedAt: now,
            reservationExpiresAt: new Date(now.getTime() + timeout),
        });


        await order.save();
        await Bicycle.findByIdAndUpdate(bicycleId, { status: 'RESERVED' });

        // Push notification to seller
        sendToUser(seller._id.toString(), {
            title: 'Đơn hàng mới',
            body: `Bạn có đơn hàng mới cho xe "${bicycle.title}"`,
            data: { type: 'NEW_ORDER', orderId: order._id.toString() }
        }).catch(err => console.error('[FCM] createOrder push error:', err));

        res.status(201).json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};





async function handleExpiredOrderForfeit(order: any) {
    if (order.amounts.escrowAmount > 0) {
        const forfeit = order.amounts.escrowAmount;
        const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
        const sellerWallet = await getOrCreateWallet(order.seller._id);

        if (buyerWallet && sellerWallet) {
            const sellerBalBefore = sellerWallet.totalEarn - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance;
            buyerWallet.frozenBalance -= forfeit;
            sellerWallet.totalReceived += forfeit;
            sellerWallet.totalEarn += forfeit;
            await buyerWallet.save();
            await sellerWallet.save();

            const txnCode = generateCode('TXN');
            await Transaction.create({
                transactionCode: txnCode,
                paymentMethod: 'SYSTEM',
                walletId: sellerWallet._id,
                type: 'FORFEIT',
                amount: forfeit,
                balanceBefore: sellerBalBefore,
                balanceAfter: sellerBalBefore + forfeit,
                description: `Reservation expired, deposit forfeited - ${order.orderCode}`,
                orderId: order._id,
            });

            order.transactions.push({
                transactionCode: txnCode, type: 'FORFEIT', amount: forfeit, status: 'SUCCESS',
                createdAt: new Date(), walletId: sellerWallet._id, paymentMethod: 'SYSTEM',
                balanceBefore: sellerBalBefore, balanceAfter: sellerBalBefore + forfeit,
                description: `Reservation expired, deposit forfeited - ${order.orderCode}`,
                paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
            } as any);
        }
        order.amounts.escrowAmount = 0;
    }
}

export const payOrder = async (

    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.buyer._id.toString() !== req.user!._id.toString()) {
            res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            return;
        }

        // Check hết hạn giữ xe
        if (order.reservationExpiresAt && new Date() > order.reservationExpiresAt) {
            await handleExpiredOrderForfeit(order);
            order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';
            await order.save();
            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });

            //Noti order expired
            notificationService.notifyOrderAutoExpired(
                order.buyer._id.toString(),
                order._id.toString(),
                order.orderCode
            );
            res.status(400).json({ success: false, message: 'Đặt chỗ đã hết hạn' });
            return;
        }

        // Xác định số tiền cần trả và loại giao dịch
        let buyerPays = 0;
        let txnType: 'DEPOSIT' | 'FULL' | 'REMAINING' = 'DEPOSIT';
        let nextStatus = '';

        switch (order.status) {
            case 'RESERVED_FULL':
                buyerPays = order.amounts.total;
                txnType = 'FULL';
                nextStatus = 'WAITING_SELLER_CONFIRMATION';
                break;
            case 'RESERVED_DEPOSIT':
                buyerPays = order.amounts.deposit;
                txnType = 'DEPOSIT';
                nextStatus = 'DEPOSIT_CONFIRMED';
                break;
            case 'DEPOSIT_CONFIRMED':
                buyerPays = order.amounts.total - order.amounts.depositPaid;
                txnType = 'REMAINING';
                nextStatus = 'WAITING_SELLER_CONFIRMATION';
                break;
            case 'WAITING_REMAINING_PAYMENT':
                buyerPays = order.amounts.total - order.amounts.depositPaid;
                txnType = 'REMAINING';
                nextStatus = 'COMPLETED';
                break;
            default:
                res.status(400).json({ success: false, message: `Cannot pay in ${order.status} status` });
                return;
        }

        // Check ví buyer
        const buyerWallet = await getOrCreateWallet(req.user!._id);
        const availableBalance = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
        if (availableBalance < buyerPays) {
            res.status(400).json({
                success: false,
                message: 'Số dư không đủ',
                data: { availableBalance, required: buyerPays }
            });
            return;
        }

        // Freeze tiền buyer (chuyển vào escrow)
        const balanceBefore = availableBalance;
        buyerWallet.frozenBalance += buyerPays;
        await buyerWallet.save();

        // Tạo Transaction record
        const txn = await Transaction.create({
            transactionCode: generateCode('TXN'),
            amount: buyerPays,
            paymentMethod: 'WALLET',
            walletId: buyerWallet._id,
            type: 'ESCROW_IN',
            balanceBefore,
            balanceAfter: balanceBefore - buyerPays,
            description: `Payment ${txnType} → Escrow - ${order.orderCode}`,
            orderId: order._id,
        });

        // Cập nhật amounts trong order
        if (txnType === 'DEPOSIT') {
            order.amounts.depositPaid = buyerPays;
        } else if (txnType === 'FULL') {
            order.amounts.depositPaid = order.amounts.deposit;
            order.amounts.remainingPaid = order.amounts.total - order.amounts.deposit;
        } else {
            order.amounts.remainingPaid = buyerPays;
        }
        order.amounts.escrowAmount += buyerPays;

        // Cập nhật status
        order.status = nextStatus as any;

        // Push transaction summary vào order
        order.transactions.push({
            transactionCode: txn.transactionCode,
            type: txnType,
            amount: buyerPays,
            status: 'SUCCESS',
            createdAt: new Date(),
            walletId: buyerWallet._id,
            paymentMethod: 'WALLET',
            balanceBefore,
            balanceAfter: balanceBefore - buyerPays,
            description: `Payment ${txnType} - ${order.orderCode}`,
            paymentGateway: '',
            gatewayTransactionId: '',
            gatewayResponseCode: ''
        } as any);

        if (nextStatus === 'COMPLETED') order.buyerConfirmedAt = new Date();
        await order.save();

        //Noti to buyer when deposit
        if (txnType === 'DEPOSIT') {
            notificationService.notifyDepositSuccess(
                req.user!._id.toString(),
                order._id.toString()
            );
        } else if (txnType === 'FULL' || txnType === 'REMAINING') {
            notificationService.notifyPaymentSuccess(
                req.user!._id.toString(),
                order._id.toString()
            );
        }
        res.status(200).json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};




export const getMyOrders = async (req: AuthRequest, res: Response) => {
    const userId = req.user!._id;
    const { role = 'all', status, page = '1', limit = '10' } = req.query;
    const filter: any = {};
    if (role === 'buyer') filter['buyer._id'] = userId;
    else if (role === 'seller') filter['seller._id'] = userId;
    else filter.$or = [{ 'buyer._id': userId }, { 'seller._id': userId }];
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit),
        Order.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: { orders, pagination: { page: +page, limit: +limit, total } } });
};







export const getOrderById = async (req: AuthRequest, res: Response) => {
    try {
        const TIMEOUT_MS = 10000; // 10 seconds

        const orderPromise = Order.findById(req.params.id);
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Hết thời gian yêu cầu')), TIMEOUT_MS)
        );

        const order = await Promise.race([orderPromise, timeoutPromise]) as any;

        if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });

        const uid = req.user!._id.toString();
        const isAdmin = req.user!.roles.includes('ADMIN');
        const isSeller = order.seller._id.toString() === uid;
        const isBuyer = order.buyer._id.toString() === uid;

        if (!isBuyer && !isSeller && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Bạn không có quyền xem đơn hàng này' });
        }

        // Hide pickupAddress from Buyer (only Admin and Seller can see)
        // const orderData = order.toObject();
        // if (isBuyer && !isAdmin) {
        //     delete orderData.pickupAddress;
        // }

        res.status(200).json({ success: true, data: order });
    } catch (error: any) {
        if (error.message === 'Hết thời gian yêu cầu') {
            return res.status(408).json({ success: false, message: 'Yêu cầu đã hết thời gian, vui lòng thử lại' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};


// CANCEL ORDER
export const cancelOrder = async (req: AuthRequest, res: Response) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.buyer._id.toString() !== req.user!._id.toString()) {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
        }

        const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });

        const sellerWallet = await getOrCreateWallet(order.seller._id);

        let refund = 0;
        let forfeit = 0;

        if (['RESERVED_FULL', 'RESERVED_DEPOSIT'].includes(order.status)) {
            refund = order.amounts.escrowAmount;
            order.status = 'CANCELLED_BY_BUYER';
        } else if (['DEPOSIT_CONFIRMED', 'WAITING_SELLER_CONFIRMATION', 'CONFIRMED', 'WAITING_FOR_PICKUP', 'IN_TRANSIT'].includes(order.status)) {
            forfeit = order.amounts.deposit;
            refund = order.amounts.escrowAmount - forfeit;
            order.status = 'CANCELLED_BY_BUYER';
        } else {
            return res.status(400).json({ success: false, message: `Cannot cancel order in ${order.status} status` });
        }

        if (buyerWallet && (refund > 0 || forfeit > 0)) {
            const buyerBalBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
            const sellerBalBefore = sellerWallet.totalEarn - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance;

            if (refund > 0) {
                buyerWallet.frozenBalance -= refund;
                const txnCode = generateCode('TXN');
                await Transaction.create({
                    transactionCode: txnCode,
                    paymentMethod: 'SYSTEM',
                    walletId: buyerWallet._id,
                    type: 'REFUND',
                    amount: refund,
                    balanceBefore: buyerBalBefore,
                    balanceAfter: buyerBalBefore + refund,
                    description: `Refund - ${order.orderCode}`,
                    orderId: order._id,
                });

                order.transactions.push({
                    transactionCode: txnCode, type: 'REFUND', amount: refund, status: 'SUCCESS',
                    createdAt: new Date(), walletId: buyerWallet._id, paymentMethod: 'SYSTEM',
                    balanceBefore: buyerBalBefore, balanceAfter: buyerBalBefore + refund,
                    description: `Refund - ${order.orderCode}`,
                    paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
                } as any);
            }

            if (forfeit > 0) {
                buyerWallet.frozenBalance -= forfeit;
                sellerWallet.totalReceived += forfeit;
                sellerWallet.totalEarn += forfeit;
                await sellerWallet.save();

                const txnCode = generateCode('TXN');
                await Transaction.create({
                    transactionCode: txnCode,
                    paymentMethod: 'SYSTEM',
                    walletId: sellerWallet._id,
                    type: 'FORFEIT',
                    amount: forfeit,
                    balanceBefore: sellerBalBefore,
                    balanceAfter: sellerBalBefore + forfeit,
                    description: `Buyer cancelled, deposit forfeited - ${order.orderCode}`,
                    orderId: order._id,
                });

                order.transactions.push({
                    transactionCode: txnCode, type: 'FORFEIT', amount: forfeit, status: 'SUCCESS',
                    createdAt: new Date(), walletId: sellerWallet._id, paymentMethod: 'SYSTEM',
                    balanceBefore: sellerBalBefore, balanceAfter: sellerBalBefore + forfeit,
                    description: `Buyer cancelled, deposit forfeited - ${order.orderCode}`,
                    paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
                } as any);
            }
            await buyerWallet.save();
        }

        order.cancelledAt = new Date();
        order.cancelReason = req.body.reason || 'Cancelled by buyer';
        order.amounts.escrowAmount = 0;
        await order.save();
        await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });

        // Push notification to seller (FCM)
        sendToUser(order.seller._id.toString(), {
            title: 'Đơn hàng đã bị huỷ',
            body: `Đơn hàng ${order.orderCode} đã bị người mua huỷ`,
            data: { type: 'ORDER_CANCELLED', orderId: order._id.toString() }
        }).catch(err => console.error('[FCM] cancelOrder push error:', err));

        //Noti cancel (in-app)
        notificationService.notifyOrderCancelled(
            req.user!._id.toString(),
            order._id.toString(),
            order.orderCode
        );
        res.status(200).json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};



export const receiveOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ success: false, message: `Cannot receive order in ${order.status} status` });

    order.status = 'COMPLETED';
    order.buyerConfirmedAt = new Date();
    await order.save();
    await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'SOLD' });

    //Noti buyer receive order
    notificationService.notifyOrderReceived(
        req.user!._id.toString(),
        order._id.toString()
    );
    res.status(200).json({ success: true, message: 'Tiền sẽ được giải phóng cho người bán sau 48 giờ', data: order });
};



export const reviewOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
    if (order.status !== 'COMPLETED' && order.status !== 'FUNDS_RELEASED') return res.status(400).json({ success: false, message: 'Chỉ có thể đánh giá đơn hàng đã hoàn thành' });
    if (order.review) return res.status(400).json({ success: false, message: 'Đơn hàng đã được đánh giá' });

    order.review = { rating: req.body.rating, comment: req.body.comment || '', createdAt: new Date() };
    await order.save();

    //Noti order review
    notificationService.notifyReviewSubmitted(
        req.user!._id.toString()
    );
    res.status(200).json({ success: true, data: order });
};





// SELLER

export const confirmOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.seller._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
    if (order.status !== 'WAITING_SELLER_CONFIRMATION') return res.status(400).json({ success: false, message: 'Invalid' });
    order.status = 'CONFIRMED';
    order.sellerConfirmedAt = new Date();
    await order.save();

    // Push notification to buyer (FCM)
    sendToUser(order.buyer._id.toString(), {
        title: 'Đơn hàng đã được xác nhận',
        body: `Đơn hàng ${order.orderCode} đã được người bán xác nhận`,
        data: { type: 'ORDER_CONFIRMED', orderId: order._id.toString() }
    }).catch(err => console.error('[FCM] confirmOrder push error:', err));

    //Noti confirm order (in-app)
    notificationService.notifyOrderConfirmed(
        order.buyer._id.toString(),
        order._id.toString(),
        order.orderCode
    );
    res.status(200).json({ success: true, data: order });
};





export const rejectOrder = async (req: AuthRequest, res: Response) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.seller._id.toString() !== req.user!._id.toString()) {
            return res.status(403).json({ success: false, message: 'Không có quyền thực hiện' });
        }
        if (order.status !== 'WAITING_SELLER_CONFIRMATION') {
            return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
        }

        // Hoàn tiền cho buyer
        const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
        const refund = order.amounts.escrowAmount;
        if (refund > 0 && buyerWallet) {
            const balBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
            const txnCode = generateCode('TXN');
            buyerWallet.frozenBalance -= refund;
            await buyerWallet.save();

            await Transaction.create({
                transactionCode: txnCode,
                paymentMethod: 'SYSTEM',
                walletId: buyerWallet._id,
                type: 'REFUND',
                amount: refund,
                balanceBefore: balBefore,
                balanceAfter: balBefore + refund,
                description: `Seller rejected - Refund - ${order.orderCode}`,
                orderId: order._id,
            });

            order.transactions.push({
                transactionCode: txnCode, type: 'REFUND', amount: refund, status: 'SUCCESS',
                createdAt: new Date(), walletId: buyerWallet._id, paymentMethod: 'SYSTEM',
                balanceBefore: balBefore, balanceAfter: balBefore + refund,
                description: `Seller rejected - Refund - ${order.orderCode}`,
                paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
            } as any);
        }

        order.status = 'REJECTED';
        order.cancelledAt = new Date();
        order.cancelReason = req.body.reason || 'Rejected by seller';
        order.amounts.escrowAmount = 0;
        await order.save();
        await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });

        // Push notification to buyer (FCM)
        sendToUser(order.buyer._id.toString(), {
            title: 'Đơn hàng bị từ chối',
            body: `Đơn hàng ${order.orderCode} đã bị người bán từ chối`,
            data: { type: 'ORDER_REJECTED', orderId: order._id.toString() }
        }).catch(err => console.error('[FCM] rejectOrder push error:', err));

        //Noti to buyer rejected order (in-app)
        notificationService.notifyOrderRejected(
            order.buyer._id.toString(),
            order._id.toString(),
            order.orderCode
        );
        res.status(200).json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};






// ADMIN
export const getAllOrders = async (req: AuthRequest, res: Response) => {
    const { status, page = '1', limit = '10' } = req.query;
    const filter: any = {}; if (status) filter.status = status;
    const [orders, total] = await Promise.all([
        Order.find(filter).sort({ createdAt: -1 }).skip((+page - 1) * +limit).limit(+limit),
        Order.countDocuments(filter),
    ]);
    res.status(200).json({ success: true, data: { orders, pagination: { page: +page, limit: +limit, total } } });
};





export const pickupOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'CONFIRMED')
        return res.status(400).json({ success: false, message: 'Đơn hàng phải ở trạng thái ĐÃ XÁC NHẬN để lấy hàng' });
    order.status = 'WAITING_FOR_PICKUP';
    await order.save();
    res.status(200).json({ success: true, data: order });
};

export const shipOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'WAITING_FOR_PICKUP')
        return res.status(400).json({ success: false, message: 'Đơn hàng phải ở trạng thái CHỜ LẤY HÀNG để giao' });
    order.status = 'IN_TRANSIT';
    await order.save();
    res.status(200).json({ success: true, data: order });
};

export const deliverOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'IN_TRANSIT')
        return res.status(400).json({ success: false, message: 'Đơn hàng phải ở trạng thái ĐANG GIAO để xác nhận giao hàng' });

    // Check nếu đã trả đủ thì chuyển thẳng sang DELIVERED
    const isPaidTotal = order.amounts.depositPaid + order.amounts.remainingPaid >= order.amounts.total;
    order.status = isPaidTotal ? 'DELIVERED' : 'WAITING_REMAINING_PAYMENT';
    await order.save();

    // Push notification to buyer
    sendToUser(order.buyer._id.toString(), {
        title: isPaidTotal ? 'Đơn hàng đã giao' : 'Đơn hàng cần thanh toán',
        body: isPaidTotal
            ? `Đơn hàng ${order.orderCode} đã được giao. Vui lòng xác nhận nhận hàng.`
            : `Đơn hàng ${order.orderCode} cần thanh toán phần còn lại`,
        data: { type: isPaidTotal ? 'ORDER_DELIVERED' : 'WAITING_REMAINING_PAYMENT', orderId: order._id.toString() }
    }).catch(err => console.error('[FCM] deliverOrder push error:', err));

    res.status(200).json({ success: true, data: order });
};



// Luồng thanh toán thẳng Vnpay
export const payOrderVnpay = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.buyer._id.toString() !== req.user!._id.toString()) {
            res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' });
            return;
        }

        if (order.reservationExpiresAt && new Date() > order.reservationExpiresAt) {
            await handleExpiredOrderForfeit(order);
            order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';
            await order.save();
            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });

            //Noti order expired
            notificationService.notifyOrderAutoExpired(
                order.buyer._id.toString(),
                order._id.toString(),
                order.orderCode
            );
            res.status(400).json({ success: false, message: 'Đặt chỗ đã hết hạn' });
            return;
        }

        // Tính tiền (giống payOrder)
        let buyerPays = 0;
        let txnType: 'DEPOSIT' | 'FULL' | 'REMAINING' = 'DEPOSIT';
        switch (order.status) {
            case 'RESERVED_FULL':
                buyerPays = order.amounts.total; txnType = 'FULL'; break;
            case 'RESERVED_DEPOSIT':
                buyerPays = order.amounts.deposit; txnType = 'DEPOSIT'; break;
            case 'DEPOSIT_CONFIRMED':
                buyerPays = order.amounts.total - order.amounts.depositPaid;
                txnType = 'REMAINING'; break;
            case 'WAITING_REMAINING_PAYMENT':
                buyerPays = order.amounts.total - order.amounts.depositPaid;
                txnType = 'REMAINING'; break;
            default:
                res.status(400).json({ success: false, message: `Cannot pay in ${order.status}` });
                return;
        }

        // Tạo Transaction PENDING
        const txnRef = generateCode('OPY');
        const buyerWallet = await getOrCreateWallet(req.user!._id);
        const balanceBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;

        await Transaction.create({
            transactionCode: txnRef,
            paymentMethod: 'VNPAY',
            walletId: buyerWallet._id,
            type: 'ESCROW_IN',
            amount: buyerPays,
            balanceBefore,
            balanceAfter: 0,
            description: `VNPay ${txnType} - ${order.orderCode}`,
            orderId: order._id,
            paymentGateway: 'VNPAY',
            data: { status: 'PENDING', txnType, orderId: order._id.toString() },
        });

        // Tạo VNPay URL
        let ipAddr = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress || '127.0.0.1';
        if (ipAddr === '::1') ipAddr = '127.0.0.1';
        if (ipAddr.startsWith('::ffff:')) ipAddr = ipAddr.substring(7);

        const paymentUrl = createPaymentUrl({
            amount: buyerPays,
            orderId: txnRef,
            orderInfo: `Pay+Order+${order.orderCode}`,
            ipAddr,
            bankCode: req.body.bankCode,
            returnUrl: process.env.VNP_ORDER_RETURN_URL,
        });

        res.status(200).json({
            success: true,
            data: { paymentUrl, txnRef, amount: buyerPays }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};





export const vnpayOrderReturn = async (req: Request, res: Response): Promise<void> => {
    try {
        const vnpParams = req.query as Record<string, string>;
        if (!verifyReturnUrl(vnpParams)) {
            res.status(400).json({ success: false, message: 'Chữ ký không hợp lệ' });
            return;
        }
        const txnRef = vnpParams['vnp_TxnRef'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const vnpAmount = parseInt(vnpParams['vnp_Amount']) / 100;
        const gatewayTxnId = vnpParams['vnp_TransactionNo'] || '';
        const transaction = await Transaction.findOne({
            transactionCode: txnRef, type: 'ESCROW_IN', 'data.status': 'PENDING'
        });
        if (!transaction) {
            res.status(404).json({ success: false, message: 'Không tìm thấy giao dịch' });
            return;
        }
        const order = await Order.findById(transaction.orderId);
        if (!order) { res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng' }); return; }
        // THẤT BẠI
        if (responseCode !== '00') {
            transaction.data = { ...transaction.data, status: 'FAILED' };
            transaction.gatewayResponseCode = responseCode;
            transaction.gatewayTransactionId = gatewayTxnId;
            await transaction.save();

            //Noti deposit failed
            notificationService.notifyPaymentFailed(
                order.buyer._id.toString(),
                order._id.toString()
            );
            const feUrl = process.env.FRONTEND_URL;
            if (feUrl) { res.redirect(`${feUrl}/orders/${order._id}?payment=failed`); }
            else { res.status(400).json({ success: false, message: getResponseMessage(responseCode) }); }
            return;
        }
        // THÀNH CÔNG → nạp + freeze cùng lúc
        await _processVnpayOrderSuccess(transaction, order, vnpAmount, gatewayTxnId, responseCode);
        const feUrl = process.env.FRONTEND_URL;
        if (feUrl) { res.redirect(`${feUrl}/orders/${order._id}?payment=success`); }
        else { res.status(200).json({ success: true, data: { orderId: order._id, amount: vnpAmount } }); }
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};



export const vnpayOrderIPN = async (req: Request, res: Response): Promise<void> => {
    try {
        const vnpParams = req.query as Record<string, string>;
        if (!verifyReturnUrl(vnpParams)) {
            res.status(200).json({ RspCode: '97', Message: 'Invalid checksum' }); return;
        }
        const txnRef = vnpParams['vnp_TxnRef'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const vnpAmount = parseInt(vnpParams['vnp_Amount']) / 100;
        const gatewayTxnId = vnpParams['vnp_TransactionNo'] || '';
        const transaction = await Transaction.findOne({ transactionCode: txnRef, type: 'ESCROW_IN' });
        if (!transaction) { res.status(200).json({ RspCode: '01', Message: 'Không tìm thấy đơn hàng' }); return; }
        if (transaction.data?.status !== 'PENDING') {
            res.status(200).json({ RspCode: '02', Message: 'Already processed' }); return;
        }
        if (transaction.amount !== vnpAmount) {
            res.status(200).json({ RspCode: '04', Message: 'Invalid amount' }); return;
        }
        const order = await Order.findById(transaction.orderId);
        if (!order) { res.status(200).json({ RspCode: '01', Message: 'Không tìm thấy đơn hàng' }); return; }
        if (responseCode !== '00') {
            transaction.data = { ...transaction.data, status: 'FAILED' };
            transaction.gatewayResponseCode = responseCode;
            transaction.gatewayTransactionId = gatewayTxnId;
            await transaction.save();

            //Noti deposit failed
            notificationService.notifyPaymentFailed(
                order.buyer._id.toString(),
                order._id.toString()
            );
            res.status(200).json({ RspCode: '00', Message: 'Confirm Success' }); return;
        }
        await _processVnpayOrderSuccess(transaction, order, vnpAmount, gatewayTxnId, responseCode);
        res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (error: any) {
        res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
};




async function _processVnpayOrderSuccess(
    transaction: any, order: any, vnpAmount: number,
    gatewayTxnId: string, responseCode: string
) {
    const buyerWallet = await Wallet.findById(transaction.walletId);
    if (!buyerWallet) throw new Error('Không tìm thấy ví');

    const balanceBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;

    // Nạp + freeze cùng lúc
    buyerWallet.totalEarn += vnpAmount;
    buyerWallet.totalReceived += vnpAmount;
    buyerWallet.frozenBalance += vnpAmount;
    await buyerWallet.save();

    // Update Transaction
    transaction.balanceBefore = balanceBefore;
    transaction.balanceAfter = balanceBefore;  // available không đổi
    transaction.gatewayTransactionId = gatewayTxnId;
    transaction.gatewayResponseCode = responseCode;
    transaction.data = { ...transaction.data, status: 'SUCCESS' };
    await transaction.save();

    // Update Order
    const txnType = transaction.data.txnType;
    if (txnType === 'DEPOSIT') order.amounts.depositPaid = vnpAmount;
    else if (txnType === 'FULL') {
        order.amounts.depositPaid = order.amounts.deposit;
        order.amounts.remainingPaid = order.amounts.total - order.amounts.deposit;
    } else order.amounts.remainingPaid = vnpAmount;

    order.amounts.escrowAmount += vnpAmount;
    // DEPOSIT → DEPOSIT_CONFIRMED, REMAINING from DEPOSIT_CONFIRMED → WAITING_SELLER_CONFIRMATION
    // FULL → WAITING_SELLER_CONFIRMATION, REMAINING from WAITING_REMAINING_PAYMENT → COMPLETED
    if (txnType === 'DEPOSIT') {
        order.status = 'DEPOSIT_CONFIRMED' as any;
    } else if (txnType === 'FULL') {
        order.status = 'WAITING_SELLER_CONFIRMATION' as any;
    } else {
        // REMAINING: check if coming from DEPOSIT_CONFIRMED or WAITING_REMAINING_PAYMENT
        const prevStatus = order.status;
        order.status = (prevStatus === 'DEPOSIT_CONFIRMED' ? 'WAITING_SELLER_CONFIRMATION' : 'COMPLETED') as any;
    }

    order.transactions.push({
        transactionCode: transaction.transactionCode,
        type: txnType, amount: vnpAmount, status: 'SUCCESS',
        createdAt: new Date(), walletId: buyerWallet._id,
        paymentMethod: 'VNPAY', balanceBefore, balanceAfter: balanceBefore,
        description: `VNPay ${txnType} - ${order.orderCode}`,
        paymentGateway: 'VNPAY', gatewayTransactionId: gatewayTxnId,
        gatewayResponseCode: responseCode
    } as any);

    //Noti deposit success
    if (txnType === 'DEPOSIT') {
        notificationService.notifyDepositSuccess(
            order.buyer._id.toString(),
            order._id.toString()
        );
    } else {
        notificationService.notifyPaymentSuccess(
            order.buyer._id.toString(),
            order._id.toString()
        );
    }
    if (order.status === 'COMPLETED') order.buyerConfirmedAt = new Date();
    await order.save();

    // Push notification to seller about VNPay payment
    sendToUser(order.seller._id.toString(), {
        title: 'Đã nhận thanh toán',
        body: `Đơn hàng ${order.orderCode} đã được thanh toán qua VNPay`,
        data: { type: 'PAYMENT_RECEIVED', orderId: order._id.toString() }
    }).catch(err => console.error('[FCM] vnpaySuccess push error:', err));
}
