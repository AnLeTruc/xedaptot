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
import mongoose from 'mongoose';
import { createPaymentUrl, verifyReturnUrl, getResponseMessage } from '../services/vnpayService';

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
            return res.status(400).json({ success: false, message: 'Bicycle is not available' });
        }

        if (bicycle.seller._id.toString() === buyer._id.toString()) {
            return res.status(400).json({ success: false, message: 'Cannot purchase your own bicycle' });
        }

        const seller = await User.findById(bicycle.seller._id);
        if (!seller) {
            return res.status(400).json({ success: false, message: 'Seller not found' });
        }
        // ktra có ng đặt chưa (ko đặt trùng)
        const existing = await Order.findOne({
            'bicycle._id': bicycleId,
            status: {
                $nin: ['COMPLETED', 'FUNDS_RELEASED', 'CANCELLED', 'CANCELLED_BY_BUYER', 'DEPOSIT_EXPIRED', 'REJECTED', 'PAYMENT_TIMEOUT']
            }
        });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Bicycle is already reserved or pending payment' });
        }

        // Shipping address
        const buyerDoc = await User.findById(buyer._id);
        const shippingAddr = buyerDoc?.addresses?.find(
            (a: any) => a._id.toString() === shippingAddressId
        );
        if (!shippingAddr || !shippingAddr.districtId || !shippingAddr.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shipping address or missing district/ward code'
            });
        }

        // Pickup address must come from bicycle.location
        if (!bicycle.location?.districtId || !bicycle.location?.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Bicycle pickup location missing GHN districtId/wardCode'
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
        res.status(201).json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};





export const payOrder = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.buyer._id.toString() !== req.user!._id.toString()) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }

        // Check hết hạn giữ xe
        if (order.reservationExpiresAt && new Date() > order.reservationExpiresAt) {
            order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';
            await order.save();
            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
            res.status(400).json({ success: false, message: 'Reservation has expired' });
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
                message: 'Insufficient balance',
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
            setTimeout(() => reject(new Error('Request timeout')), TIMEOUT_MS)
        );

        const order = await Promise.race([orderPromise, timeoutPromise]) as any;

        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

        const uid = req.user!._id.toString();
        const isAdmin = req.user!.roles.includes('ADMIN');
        const isSeller = order.seller._id.toString() === uid;
        const isBuyer = order.buyer._id.toString() === uid;

        if (!isBuyer && !isSeller && !isAdmin) {
            return res.status(403).json({ success: false, message: 'You do not have permission to view this order' });
        }

        // Hide pickupAddress from Buyer (only Admin and Seller can see)
        // const orderData = order.toObject();
        // if (isBuyer && !isAdmin) {
        //     delete orderData.pickupAddress;
        // }

        res.status(200).json({ success: true, data: order });
    } catch (error: any) {
        if (error.message === 'Request timeout') {
            return res.status(408).json({ success: false, message: 'Request timed out, please try again' });
        }
        res.status(500).json({ success: false, message: error.message });
    }
};


// CANCEL ORDER
export const cancelOrder = async (req: AuthRequest, res: Response) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.buyer._id.toString() !== req.user!._id.toString()) {
            return res.status(403).json({ success: false, message: 'Permission denied' });
        }

        const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });

        // Before seller confirm → hoàn 100%
        if (['RESERVED_FULL', 'RESERVED_DEPOSIT', 'WAITING_SELLER_CONFIRMATION'].includes(order.status)) {
            const refund = order.amounts.escrowAmount;
            if (refund > 0 && buyerWallet) {
                const balBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
                buyerWallet.frozenBalance -= refund;
                await buyerWallet.save();

                await Transaction.create({
                    transactionCode: generateCode('TXN'),
                    paymentMethod: 'SYSTEM',
                    walletId: buyerWallet._id,
                    type: 'REFUND',
                    amount: refund,
                    balanceBefore: balBefore,
                    balanceAfter: balBefore + refund,
                    description: `Refund - ${order.orderCode}`,
                    orderId: order._id,
                });

                order.transactions.push({
                    transactionCode: generateCode('TXN'), type: 'REFUND', amount: refund, status: 'SUCCESS',
                    createdAt: new Date(), walletId: buyerWallet._id, paymentMethod: 'SYSTEM',
                    balanceBefore: balBefore, balanceAfter: balBefore + refund,
                    description: `Refund - ${order.orderCode}`,
                    paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
                } as any);
            }
            order.status = 'CANCELLED';
        }
        // After seller confirm → mất cọc (chuyển cho Seller)
        else if (['CONFIRMED', 'WAITING_FOR_PICKUP', 'IN_TRANSIT'].includes(order.status)) {
            const forfeit = order.amounts.escrowAmount;
            const sellerWallet = await getOrCreateWallet(order.seller._id);

            if (forfeit > 0 && buyerWallet) {
                const sellerBalBefore = sellerWallet.totalEarn - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance;
                buyerWallet.frozenBalance -= forfeit;
                sellerWallet.totalReceived += forfeit;
                sellerWallet.totalEarn += forfeit;
                await buyerWallet.save();
                await sellerWallet.save();

                await Transaction.create({
                    transactionCode: generateCode('TXN'),
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
                    transactionCode: generateCode('TXN'), type: 'FORFEIT', amount: forfeit, status: 'SUCCESS',
                    createdAt: new Date(), walletId: sellerWallet._id, paymentMethod: 'SYSTEM',
                    balanceBefore: sellerBalBefore, balanceAfter: sellerBalBefore + forfeit,
                    description: `Buyer cancelled, deposit forfeited - ${order.orderCode}`,
                    paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
                } as any);
            }
            order.status = 'CANCELLED_BY_BUYER';
        } else {
            return res.status(400).json({ success: false, message: `Cannot cancel order in ${order.status} status` });
        }

        order.cancelledAt = new Date();
        order.cancelReason = req.body.reason || 'Cancelled by buyer';
        order.amounts.escrowAmount = 0;
        await order.save();
        await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
        res.status(200).json({ success: true, data: order });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};



export const receiveOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Permission denied' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ success: false, message: `Cannot receive order in ${order.status} status` });

    order.status = 'COMPLETED';
    order.buyerConfirmedAt = new Date();
    await order.save();
    await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'SOLD' });
    res.status(200).json({ success: true, message: 'Funds will be released to seller after 48 hours', data: order });
};



export const reviewOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Permission denied' });
    if (order.status !== 'COMPLETED' && order.status !== 'FUNDS_RELEASED') return res.status(400).json({ success: false, message: 'Can only review completed orders' });
    if (order.review) return res.status(400).json({ success: false, message: 'Order has already been reviewed' });

    order.review = { rating: req.body.rating, comment: req.body.comment || '', createdAt: new Date() };
    await order.save();
    res.status(200).json({ success: true, data: order });
};





// SELLER

export const confirmOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.seller._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Permission denied' });
    if (order.status !== 'WAITING_SELLER_CONFIRMATION') return res.status(400).json({ success: false, message: 'Invalid' });
    order.status = 'CONFIRMED';
    order.sellerConfirmedAt = new Date();
    await order.save();
    res.status(200).json({ success: true, data: order });
};





export const rejectOrder = async (req: AuthRequest, res: Response) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.seller._id.toString() !== req.user!._id.toString()) {
            return res.status(403).json({ success: false, message: 'Permission denied' });
        }
        if (order.status !== 'WAITING_SELLER_CONFIRMATION') {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }

        // Hoàn tiền cho buyer
        const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
        const refund = order.amounts.escrowAmount;
        if (refund > 0 && buyerWallet) {
            const balBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
            buyerWallet.frozenBalance -= refund;
            await buyerWallet.save();

            await Transaction.create({
                transactionCode: generateCode('TXN'),
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
                transactionCode: generateCode('TXN'), type: 'REFUND', amount: refund, status: 'SUCCESS',
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
        return res.status(400).json({ success: false, message: 'Order must be CONFIRMED to pickup' });
    order.status = 'WAITING_FOR_PICKUP';
    await order.save();
    res.status(200).json({ success: true, data: order });
};

export const shipOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'WAITING_FOR_PICKUP')
        return res.status(400).json({ success: false, message: 'Order must be WAITING_FOR_PICKUP to ship' });
    order.status = 'IN_TRANSIT';
    await order.save();
    res.status(200).json({ success: true, data: order });
};

export const deliverOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'IN_TRANSIT')
        return res.status(400).json({ success: false, message: 'Order must be IN_TRANSIT to deliver' });

    // Nếu DEPOSIT_10: chưa trả hết → chờ trả nốt
    // Nếu FULL_100: đã trả hết → giao xong
    order.status = order.paymentType === 'DEPOSIT_10' ? 'WAITING_REMAINING_PAYMENT' : 'DELIVERED';
    await order.save();
    res.status(200).json({ success: true, data: order });
};



// Luồng thanh toán thẳng Vnpay
export const payOrderVnpay = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.buyer._id.toString() !== req.user!._id.toString()) {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }

        if (order.reservationExpiresAt && new Date() > order.reservationExpiresAt) {
            order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';
            await order.save();
            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
            res.status(400).json({ success: false, message: 'Reservation has expired' });
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
            res.status(400).json({ success: false, message: 'Invalid signature' });
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
            res.status(404).json({ success: false, message: 'Transaction not found' });
            return;
        }
        const order = await Order.findById(transaction.orderId);
        if (!order) { res.status(404).json({ success: false, message: 'Order not found' }); return; }
        // THẤT BẠI
        if (responseCode !== '00') {
            transaction.data = { ...transaction.data, status: 'FAILED' };
            transaction.gatewayResponseCode = responseCode;
            transaction.gatewayTransactionId = gatewayTxnId;
            await transaction.save();
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
        if (!transaction) { res.status(200).json({ RspCode: '01', Message: 'Order not found' }); return; }
        if (transaction.data?.status !== 'PENDING') {
            res.status(200).json({ RspCode: '02', Message: 'Already processed' }); return;
        }
        if (transaction.amount !== vnpAmount) {
            res.status(200).json({ RspCode: '04', Message: 'Invalid amount' }); return;
        }
        const order = await Order.findById(transaction.orderId);
        if (!order) { res.status(200).json({ RspCode: '01', Message: 'Order not found' }); return; }
        if (responseCode !== '00') {
            transaction.data = { ...transaction.data, status: 'FAILED' };
            transaction.gatewayResponseCode = responseCode;
            transaction.gatewayTransactionId = gatewayTxnId;
            await transaction.save();
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
    if (!buyerWallet) throw new Error('Wallet not found');

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
    order.status = (txnType === 'REMAINING' ? 'COMPLETED' : 'WAITING_SELLER_CONFIRMATION') as any;

    order.transactions.push({
        transactionCode: transaction.transactionCode,
        type: txnType, amount: vnpAmount, status: 'SUCCESS',
        createdAt: new Date(), walletId: buyerWallet._id,
        paymentMethod: 'VNPAY', balanceBefore, balanceAfter: balanceBefore,
        description: `VNPay ${txnType} - ${order.orderCode}`,
        paymentGateway: 'VNPAY', gatewayTransactionId: gatewayTxnId,
        gatewayResponseCode: responseCode
    } as any);

    if (order.status === 'COMPLETED') order.buyerConfirmedAt = new Date();
    await order.save();
}
