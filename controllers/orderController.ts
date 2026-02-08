import { Response } from 'express';
import { AuthRequest } from '../types';
import Order from '../models/Order';
import Bicycle from '../models/Bicycle';
import User from '../models/User';
// import Wallet from '../models/Wallet';
import { ORDER_TIMEOUTS, FEE_CONFIG } from '../types/order'
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
        const { bicycleId, paymentType, discountPercent = 0, discountReason = '' } = req.body;

        const bicycle = await Bicycle.findById(bicycleId);
        if (!bicycle || bicycle.status != 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Xe không khả dụng' });
        }

        if (bicycle.seller._id.toString() === buyer._id.toString()) {
            return res.status(400).json({ success: false, message: 'Không thể mua xe của chính mình' });
        }
        // ktra có ng đặt chưa (ko đặt trùng)
        const existing = await Order.findOne({
            'bicycle._id': bicycleId,
            status: {
                $nin: ['COMPLETED', 'FUNDS_RELEASED', 'CANCELLED', 'CANCELLED_BY_BUYER', 'DEPOSIT_EXPIRED', 'REJECTED', 'PAYMENT_TIMEOUT']
            }
        });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Xe đang có người đặt cọc hoặc chờ thanh toán' });
        }

        const seller = await User.findById(bicycle.seller._id);

        const originalPrice = bicycle.price;
        const discountAmount = Math.round(originalPrice * discountPercent / 100);
        const finalPrice = originalPrice - discountAmount;
        const shipping = 0;
        const total = finalPrice + shipping;
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
            // shippingAddress: {
            //     street: shippingAddr.street,
            //     city: shippingAddr.city,
            //     district: shippingAddr.district,
            //     ward: shippingAddr.ward,
            // },
            // // Lấy địa chỉ từ seller để System biết đến đâu lấy hàng
            // pickupAddress: {
            //     street: seller?.address?.[0]?.street,
            //     city: seller?.address?.[0]?.city,
            //     district: seller?.address?.[0]?.district,
            //     ward: seller?.address?.[0]?.ward,
            // },
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
                // shippingFee: shipping,  
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
        if(!order || order.buyer._id.toString() !== req.user!._id.toString()){
            res.status(404).json({
                success: false,
                message: 'Đơn hàng không tồn tại'
            });
            return;
        }
        if(order.reservationExpiresAt && new Date() > order.reservationExpiresAt){
            order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';
            await order.save();
            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
            res.status(400).json({
                success: false,
                message: 'Thời gian đặt cọc đã hết hạn'
            })
        }   


        let buyerPays = 0, txnType: 'DEPOSIT' | 'FULL' | 'REMAINING' = 'DEPOSIT', nextStatus = '';

        switch ( order.status ) {
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
                    message: `Đơn hàng không ở trạng thái thanh toán hợp lệ`
                });
        }

            
        // const buyerWallet = await Wallet.findOne({ userId: req.user!._id });
        // if (!buyerWallet || buyerWallet.balance < buyerPays) {
        //     res.status(400).json({ success: false, message: 'Số dư không đủ', required: buyerPays });
        // }


        // const txn = await new Transaction({
        //     transactionCode: generateCode('TXN'),
        //     amount: buyerPays,
        //     paymentMethod: 'WALLET',
        //     status: 'SUCCESS',
        //     walletId: buyerWallet._id,
        //     type: 'ESCROW_IN',
        //     balanceBefore: buyerWallet.balance,
        //     balanceAfter: buyerWallet.balance - buyerPays,
        //     description: `Thanh toán ${txnType} → Escrow - ${order.orderCode}`,
        //     orderId: order._id,
        //     userId: req.user!._id,
        // }).save();

        // buyerWallet.balance -= buyerPays;
        // buyerWallet.frozenBalance += buyerPays;  // Option B: frozenBalance thay vì SystemWallet
        // await buyerWallet.save();

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
        //order.transactions.push({ transactionId: txn._id, type: txnType, amount: buyerPays, status: 'SUCCESS', createdAt: new Date() });

        if (nextStatus === 'COMPLETED') order.buyerConfirmedAt = new Date();
        await order.save();

        res.status(200).json({ success: true, data: order });
        
    } catch (error : any){
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
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Không tìm thấy' });
    const uid = req.user!._id.toString();
    const isAdmin = req.user!.roles.includes('ADMIN');
    const isSeller = order.seller._id.toString() === uid;
    const isBuyer = order.buyer._id.toString() === uid;
    
    if (!isBuyer && !isSeller && !isAdmin) {
        return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
     
    // Ẩn pickupAddress với Buyer (chỉ Admin và Seller thấy)
    // const orderData = order.toObject();
    // if (isBuyer && !isAdmin) {
    //     delete orderData.pickupAddress;
    // }
    
    // res.status(200).json({ success: true, data: orderData });
};


// HỦY TRƯỚC SELLER CONFIRM
export const cancelOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền' });

    // Option B: frozenBalance thay vì SystemWallet
    // const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });

    // Trước seller confirm → hoàn tiền
    if (['RESERVED_FULL', 'RESERVED_DEPOSIT', 'WAITING_SELLER_CONFIRMATION'].includes(order.status)) {
        const refund = order.amounts.escrowAmount;
        // if (refund > 0 && buyerWallet) {
        //     buyerWallet.frozenBalance -= refund;
        //     buyerWallet.balance += refund;
        //     await buyerWallet.save();
        //     order.transactions.push({
        //         transactionCode: generateCode('TXN'), type: 'REFUND', amount: refund, status: 'SUCCESS',
        //         createdAt: new Date(), walletId: buyerWallet._id, paymentMethod: 'SYSTEM',
        //         balanceBefore: buyerWallet.balance - refund, balanceAfter: buyerWallet.balance,
        //         description: `Hoàn tiền - ${order.orderCode}`, paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
        //     });
        // }
        order.status = 'CANCELLED';
    }
    // Sau seller confirm → Mất cọc (chuyển cho Seller)
    else if (['CONFIRMED', 'WAITING_FOR_PICKUP', 'IN_TRANSIT'].includes(order.status)) {
        const forfeit = order.amounts.escrowAmount;
        // let sellerWallet = await Wallet.findOne({ userId: order.seller._id });
        // if (!sellerWallet) sellerWallet = await new Wallet({ userId: order.seller._id, balance: 0, frozenBalance: 0 }).save();
        // if (forfeit > 0 && buyerWallet) {
        //     buyerWallet.frozenBalance -= forfeit;
        //     sellerWallet.balance += forfeit;
        //     await buyerWallet.save();
        //     await sellerWallet.save();
        //     order.transactions.push({
        //         transactionCode: generateCode('TXN'), type: 'FORFEIT', amount: forfeit, status: 'SUCCESS',
        //         createdAt: new Date(), walletId: sellerWallet._id, paymentMethod: 'SYSTEM',
        //         balanceBefore: sellerWallet.balance - forfeit, balanceAfter: sellerWallet.balance,
        //         description: `Buyer hủy đơn, mất cọc - ${order.orderCode}`, paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
        //     });
        // }
        order.status = 'CANCELLED_BY_BUYER';
    } else {
        return res.status(400).json({ success: false, message: `Không thể hủy ở ${order.status}` });
    }

    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || 'Buyer hủy';
    order.amounts.escrowAmount = 0;
    await order.save();
    await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
    res.status(200).json({ success: true, data: order });
};



export const receiveOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền' });
    if (order.status !== 'DELIVERED') return res.status(400).json({ success: false, message: `Không thể ở ${order.status}` });

    order.status = 'COMPLETED';
    order.buyerConfirmedAt = new Date();
    await order.save();
    await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'SOLD' });
    res.status(200).json({ success: true, message: '48h sau tiền sẽ chuyển cho seller', data: order });
};





// SELLER

export const confirmOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.seller._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền' });
    if (order.status !== 'WAITING_SELLER_CONFIRMATION') return res.status(400).json({ success: false, message: 'Invalid' });
    order.status = 'CONFIRMED';
    order.sellerConfirmedAt = new Date();
    await order.save();
    res.status(200).json({ success: true, data: order });
};





export const rejectOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.seller._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền' });
    if (order.status !== 'WAITING_SELLER_CONFIRMATION') return res.status(400).json({ success: false, message: 'Invalid' });
    // const escrow = await getEscrowWallet();
    // const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
    // const refund = order.amounts.escrowAmount;
    // if (refund > 0 && buyerWallet && escrow) {
    //     escrow.balance -= refund;
    //     buyerWallet.balance += refund;
    //     await escrow.save();
    //     await buyerWallet.save();
    // }

    order.status = 'REJECTED';
    order.cancelledAt = new Date();
    order.cancelReason = req.body.reason || 'Seller từ chối';
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