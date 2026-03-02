import { Response } from 'express';
import { AuthRequest } from '../types';
import Order from '../models/Order';
import Bicycle from '../models/Bicycle';
import User from '../models/User';
// import Wallet from '../models/Wallet';
// import Transaction from '../models/Transaction';
import { ORDER_TIMEOUTS, FEE_CONFIG } from '../types/order'
import { calculateShippingFee } from '../services/shippingService';
import mongoose from 'mongoose';

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

        const seller = await User.findById(bicycle.seller._id);

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

        const pickupAddr = seller?.addresses?.find((a: any) => a.isDefault)
            || seller?.addresses?.[0];
        if (!pickupAddr || !pickupAddr.districtId || !pickupAddr.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Seller has not updated pickup address'
            });
        }

        const originalPrice = bicycle.price;
        const discountAmount = Math.round(originalPrice * discountPercent / 100);
        const finalPrice = originalPrice - discountAmount;

        //GHN Shipping fee
        let shippingFee = 0;
        try {
            const shippingResult = await calculateShippingFee({
                fromDistrictId: pickupAddr.districtId,
                fromWardCode: pickupAddr.wardCode,
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
                _id: seller!._id,
                fullName: seller!.fullName || '',
                phone: seller!.phone,
            },
            shippingAddress: {
                street: shippingAddr.street,
                city: shippingAddr.city,
                district: shippingAddr.district,
                ward: shippingAddr.ward,
                districtId: shippingAddr.districtId,
                wardCode: shippingAddr.wardCode,
            },
            pickupAddress: {
                street: pickupAddr.street,
                city: pickupAddr.city,
                district: pickupAddr.district,
                ward: pickupAddr.ward,
                districtId: pickupAddr.districtId,
                wardCode: pickupAddr.wardCode,
            },
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
            res.status(404).json({
                success: false,
                message: 'Order not found'
            });
            return;
        }
        if (order.reservationExpiresAt && new Date() > order.reservationExpiresAt) {
            order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';
            await order.save();
            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
            res.status(400).json({
                success: false,
                message: 'Reservation has expired'
            })
        }


        let buyerPays = 0, txnType: 'DEPOSIT' | 'FULL' | 'REMAINING' = 'DEPOSIT', nextStatus = '';

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
                buyerPays = order.amounts.total - order.amounts.deposit;
                txnType = 'REMAINING';
                nextStatus = 'COMPLETED';
                break;
            default:
                res.status(400).json({
                    success: false,
                    message: 'Order is not in a valid payment status'
                });
        }

        // const buyerWallet = await Wallet.findOne({ userId: req.user!._id });
        // if (!buyerWallet || (buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance) < buyerPays) {
        //     res.status(400).json({ success: false, message: 'Insufficient balance', required: buyerPays });
        // }
        //
        // const balanceBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
        // buyerWallet.frozenBalance += buyerPays;
        // await buyerWallet.save();
        //
        // await Transaction.create({
        //     transactionCode: generateCode('TXN'),
        //     amount: buyerPays,
        //     paymentMethod: 'WALLET',
        //     walletId: buyerWallet._id,
        //     type: 'ESCROW_IN',
        //     balanceBefore,
        //     balanceAfter: balanceBefore - buyerPays,
        //     description: `Payment ${txnType} → Escrow - ${order.orderCode}`,
        //     orderId: order._id,
        // });

        if (txnType === 'DEPOSIT') {
            order.amounts.depositPaid = buyerPays;
        } else if (txnType === 'FULL') {
            order.amounts.depositPaid = order.amounts.deposit;
            order.amounts.remainingPaid = order.amounts.total - order.amounts.deposit;
        } else {
            order.amounts.remainingPaid = buyerPays;
        }
        order.amounts.escrowAmount += buyerPays;

        order.status = nextStatus as any;

        // order.transactions.push({
        //     transactionCode: generateCode('TXN'),
        //     type: txnType,
        //     amount: buyerPays,
        //     status: 'SUCCESS',
        //     createdAt: new Date(),
        //     walletId: buyerWallet._id,
        //     paymentMethod: 'WALLET',
        //     balanceBefore,
        //     balanceAfter: balanceBefore - buyerPays,
        //     description: `Payment ${txnType} - ${order.orderCode}`,
        //     paymentGateway: '',
        //     gatewayTransactionId: '',
        //     gatewayResponseCode: ''
        // } as any);

        if (nextStatus === 'COMPLETED') order.buyerConfirmedAt = new Date();
        await order.save();

        res.status(200).json({ success: true, data: order });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}




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


// CANCEL BEFORE SELLER CONFIRM
export const cancelOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Permission denied' });

    // TODO [OTHER DEV - Payment Integration]:
    // Uncomment when integrating VNPay. Wallet uses userId (not sellerId).
    // const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });

    // Before seller confirm → refund
    if (['RESERVED_FULL', 'RESERVED_DEPOSIT', 'WAITING_SELLER_CONFIRMATION'].includes(order.status)) {
        const refund = order.amounts.escrowAmount;
        // if (refund > 0 && buyerWallet) {
        //     buyerWallet.frozenBalance -= refund;
        //     buyerWallet.totalEarn += refund;
        //     await buyerWallet.save();
        //     await Transaction.create({
        //         transactionCode: generateCode('TXN'), paymentMethod: 'SYSTEM',
        //         walletId: buyerWallet._id, type: 'REFUND', amount: refund,
        //         balanceBefore: balBefore, balanceAfter: balBefore + refund,
        //         description: `Refund - ${order.orderCode}`, orderId: order._id
        //     });
        // }
        order.status = 'CANCELLED';
    }
    // After seller confirm → Forfeit deposit (transfer to Seller)
    else if (['CONFIRMED', 'WAITING_FOR_PICKUP', 'IN_TRANSIT'].includes(order.status)) {
        const forfeit = order.amounts.escrowAmount;
        // let sellerWallet = await Wallet.findOne({ userId: order.seller._id });
        // if (!sellerWallet) sellerWallet = await Wallet.create({ userId: order.seller._id });
        // if (forfeit > 0 && buyerWallet) {
        //     buyerWallet.frozenBalance -= forfeit;
        //     sellerWallet.totalReceived += forfeit;
        //     sellerWallet.totalEarn += forfeit;
        //     await buyerWallet.save();
        //     await sellerWallet.save();
        //     await Transaction.create({
        //         transactionCode: generateCode('TXN'), paymentMethod: 'SYSTEM',
        //         walletId: sellerWallet._id, type: 'FORFEIT', amount: forfeit,
        //         balanceBefore: sellerBalBefore, balanceAfter: sellerBalBefore + forfeit,
        //         description: `Buyer cancelled, deposit forfeited - ${order.orderCode}`, orderId: order._id
        //     });
        // }
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
    const order = await Order.findById(req.params.id);
    if (!order || order.seller._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Permission denied' });
    if (order.status !== 'WAITING_SELLER_CONFIRMATION') return res.status(400).json({ success: false, message: 'Invalid' });
    // TODO [OTHER DEV - Payment Integration]:
    // Uncomment when integrating VNPay. Wallet uses userId.
    // const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
    // const refund = order.amounts.escrowAmount;
    // if (refund > 0 && buyerWallet) {
    //     const balBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
    //     buyerWallet.frozenBalance -= refund;
    //     buyerWallet.totalEarn += refund;
    //     await buyerWallet.save();
    // }

    order.status = 'REJECTED';
    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || 'Rejected by seller';
    order.amounts.escrowAmount = 0;
    await order.save();
    await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
    res.status(200).json({ success: true, data: order });
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





// export const pickupOrder = async (req: AuthRequest, res: Response) => {
//     const order = await Order.findById(req.params.id);
//     if (!order || order.status !== 'CONFIRMED') return res.status(400).json({ success: false, message: 'Invalid' });
//     order.status = 'WAITING_FOR_PICKUP';
//     await order.save();
//     res.status(200).json({ success: true, data: order });
// };

// export const shipOrder = async (req: AuthRequest, res: Response) => {
//     const order = await Order.findById(req.params.id);
//     if (!order || order.status !== 'WAITING_FOR_PICKUP') return res.status(400).json({ success: false, message: 'Invalid' });
//     order.status = 'IN_TRANSIT';
//     await order.save();
//     res.status(200).json({ success: true, data: order });
// };

// export const deliverOrder = async (req: AuthRequest, res: Response) => {
//     const order = await Order.findById(req.params.id);
//     if (!order || order.status !== 'IN_TRANSIT') return res.status(400).json({ success: false, message: 'Invalid' });
//     order.status = order.paymentType === 'DEPOSIT_10' ? 'WAITING_REMAINING_PAYMENT' : 'DELIVERED';
//     await order.save();
//     res.status(200).json({ success: true, data: order });
// };