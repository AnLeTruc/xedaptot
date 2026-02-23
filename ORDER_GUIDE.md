# 📚 Order & Transaction - Hướng Dẫn Hoàn Chỉnh (FINAL v2)

## Business Logic
- **Option A**: Seller mua gói đăng bài, không thu % khi bán
- **Escrow**: Tiền giữ trong hệ thống, chuyển Seller sau 48h buyer confirm
- **Hủy đơn**: Trước confirm → hoàn 100% | Sau confirm → mất cọc

---

# 1. TYPES

## 📁 `types/order.ts`

```typescript
import { Document, Types } from 'mongoose';

export type OrderStatus =
    | 'RESERVED_FULL'
    | 'RESERVED_DEPOSIT'
    | 'DEPOSIT_EXPIRED'
    | 'PAYMENT_TIMEOUT'
    | 'WAITING_SELLER_CONFIRMATION'
    | 'CONFIRMED'
    | 'REJECTED'
    | 'WAITING_FOR_PICKUP'
    | 'IN_TRANSIT'
    | 'DELIVERED'
    | 'WAITING_REMAINING_PAYMENT'
    | 'COMPLETED'
    | 'FUNDS_RELEASED'
    | 'CANCELLED'
    | 'CANCELLED_BY_BUYER'
    | 'DISPUTED';

export type PaymentType = 'DEPOSIT_10' | 'FULL_100';

export const FEE_CONFIG = { DEPOSIT_PERCENT: 0.1 };
export const ORDER_TIMEOUTS = {
    FULL_PAYMENT: 10 * 60 * 60 * 1000,     // 10 GIờ
    DEPOSIT_RESERVATION: 48 * 60 * 60 * 1000, // 48 giờ
    FUNDS_RELEASE: 48 * 60 * 60 * 1000,       // 48 giờ
};

// Pricing (giá và giảm giá)
export interface IOrderPricing {
    originalPrice: number;     // Giá gốc
    discountAmount: number;    // Số tiền giảm
    discountPercent: number;   // % giảm
    discountReason?: string;   // Lý do giảm
    finalPrice: number;        // Giá sau giảm
}

// Amount (số tiền giao dịch)
export interface IOrderAmount {
    total: number;             // Tổng buyer trả (finalPrice + shippingFee)
    deposit: number;           // Tiền cọc 10%
    
    /**
     * Phí vận chuyển (shippingFee)
     * 
     * TODO: Team Shipping sẽ implement phần tính phí này
     * 
     * Cách tính (dự kiến):
     * - FE so sánh: seller.province vs buyer.province
     * - Nội tỉnh (cùng province): phí thấp hơn
     * - Ngoại tỉnh (khác province): phí cao hơn
     * 
     * Flow:
     * 1. FE lấy seller.province từ Bicycle/User
     * 2. FE lấy buyer.province từ shippingAddress
     * 3. FE tính shippingFee dựa trên khoảng cách
     * 4. FE truyền shippingFee vào createOrder API
     * 5. BE nhận và lưu vào Order.amounts.shippingFee
     * 
     * Giá trị: FE truyền vào, BE không tự tính
     */
    // shippingFee: number;  // TODO: Team Shipping uncomment
    
    pricing: IOrderPricing;    // Chi tiết giá
    // Tracking
    depositPaid: number;
    remainingPaid: number;
    escrowAmount: number;      // Tiền đang giữ trong Escrow
    releasedAmount: number;    // Tiền đã chuyển cho Seller
}

// Shipping Address (embed vào Order - giống address trong diagram)
export interface IShippingAddress {
    street?: string;
    city?: string;
    district?: string;
    ward?: string;
}

// User snapshot
export interface IOrderUser {
    _id: Types.ObjectId;
    fullName: string;
    email?: string; // Optional
    phone?: string; // Optional
}

// Bicycle snapshot
export interface IOrderBicycle {
    _id: Types.ObjectId;
    title: string;
    price: number;
    primaryImage?: string;
    condition?: string;
}

// Review
export interface IOrderReview {
    rating: number;
    comment: string;
    createdAt: Date;
}

// Transaction trong order (đúng diagram)
export interface IOrderTransaction {
    transactionCode: string;
    amount: number;
    paymentMethod: string;
    status: string;
    createdAt: Date;
    walletId: Types.ObjectId;
    type: string;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    paymentGateway: string;
    gatewayTransactionId: string;
    gatewayResponseCode: string;
}

// Main Order
export interface IOrder {
    orderCode: string;
    status: OrderStatus;
    paymentType: PaymentType;
    buyer: IOrderUser;
    seller: IOrderUser;
    bicycle: IOrderBicycle;
    // TODO: Team Shipping uncomment
    // shippingAddress: IShippingAddress;
    // pickupAddress: IShippingAddress;
    amounts: IOrderAmount;
    transactions: IOrderTransaction[];
    review?: IOrderReview;
    createdAt?: Date;
    completedAt?: Date;
    sellerConfirmedAt?: Date;
    buyerConfirmedAt?: Date;
    fundsReleasedAt?: Date;
    cancelledAt?: Date;
    cancelReason?: string;
    reservedAt?: Date;
    reservationExpiresAt?: Date;
}

export interface IOrderDocument extends IOrder, Document {
    createdAt: Date;
    updatedAt: Date;
}
```

---

# 2. MODELS

## 📁 `models/Order.ts`

```typescript
import mongoose, { Schema } from 'mongoose';
import { IOrderDocument } from '../types/order';

const shippingAddressSchema = {
    street: String,
    city: String,
    district: String,
    ward: String,
};

const pricingSchema = {
    originalPrice: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountReason: String,
    finalPrice: { type: Number, required: true },
};

const orderSchema = new Schema<IOrderDocument>(
    {
        orderCode: { type: String, required: true, unique: true, index: true },
        status: {
            type: String,
            enum: [
                'RESERVED_FULL', 'RESERVED_DEPOSIT', 'DEPOSIT_EXPIRED', 'PAYMENT_TIMEOUT',
                'WAITING_SELLER_CONFIRMATION', 'CONFIRMED', 'REJECTED',
                'WAITING_FOR_PICKUP', 'IN_TRANSIT', 'DELIVERED', 'WAITING_REMAINING_PAYMENT',
                'COMPLETED', 'FUNDS_RELEASED', 'CANCELLED', 'CANCELLED_BY_BUYER', 'DISPUTED'
            ],
            default: 'RESERVED_DEPOSIT',
        },
        paymentType: { type: String, enum: ['DEPOSIT_10', 'FULL_100'], required: true },
        buyer: {
            _id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            fullName: { type: String, required: true },
            email: String,
            phone: String,
        },
        seller: {
            _id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
            fullName: { type: String, required: true },
            email: String,
            phone: String,
        },
        // TODO: Team Shipping uncomment
        // shippingAddress: shippingAddressSchema,
        // pickupAddress: shippingAddressSchema,
        bicycle: {
            _id: { type: Schema.Types.ObjectId, ref: 'Bicycle', required: true },
            title: { type: String, required: true },
            price: { type: Number, required: true },
            primaryImage: String,
            condition: String,
        },
        amounts: {
            total: { type: Number, required: true },
            deposit: { type: Number, required: true },
            // shippingFee: { type: Number, default: 0 },  // TODO: Team Shipping uncomment
            pricing: pricingSchema,
            depositPaid: { type: Number, default: 0 },
            remainingPaid: { type: Number, default: 0 },
            escrowAmount: { type: Number, default: 0 },
            releasedAmount: { type: Number, default: 0 },
        },
        transactions: [{
            transactionCode: String,
            amount: Number,
            paymentMethod: String,
            status: String,
            createdAt: { type: Date, default: Date.now },
            walletId: { type: Schema.Types.ObjectId, ref: 'Wallet' },
            type: String,
            balanceBefore: Number,
            balanceAfter: Number,
            description: String,
            paymentGateway: String,
            gatewayTransactionId: String,
            gatewayResponseCode: String,
        }],
        review: {
            rating: { type: Number, min: 1, max: 5 },
            comment: { type: String, maxlength: 1000 },
            createdAt: Date,
        },
        completedAt: Date,
        sellerConfirmedAt: Date,
        buyerConfirmedAt: Date,
        fundsReleasedAt: Date,
        cancelledAt: Date,
        cancelReason: String,
        reservedAt: Date,
        reservationExpiresAt: Date,
    },
    { timestamps: true }
);

orderSchema.index({ 'buyer._id': 1, status: 1 });
orderSchema.index({ 'seller._id': 1, status: 1 });
orderSchema.index({ status: 1, buyerConfirmedAt: 1 });

export default mongoose.model<IOrderDocument>('Order', orderSchema);
```

> [!IMPORTANT]
> **Chúng ta dùng Option B (frozenBalance)**: Tiền giữ trực tiếp trong `Wallet.frozenBalance` của Buyer, không cần `SystemWallet` (Escrow Wallet) riêng biệt. Điều này giúp dễ quản lý và minh bạch hơn.

---

# 3. CONTROLLERS

## 📁 `controllers/orderController.ts`

```typescript
import { Response } from 'express';
import { AuthRequest } from '../types';
import Order from '../models/Order';
import Bicycle from '../models/Bicycle';
import User from '../models/User';
import Wallet from '../models/Wallet';
import { ORDER_TIMEOUTS, FEE_CONFIG } from '../types/order';
import mongoose from 'mongoose';

const generateCode = (prefix: string) => {
    const d = new Date().toISOString().slice(0,10).replace(/-/g,'');
    return `${prefix}-${d}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
};

// ============================================
// 🛒 BUYER
// ============================================

export const createOrder = async (req: AuthRequest, res: Response) => {
    try {
        const buyer = req.user!;
        const { bicycleId, paymentType, shippingFee = 0, discountAmount = 0, discountPercent = 0, discountReason = '', shippingAddressId } = req.body;
        // TODO: shippingFee - Team Shipping sẽ implement logic tính phí vận chuyển

        // Lấy địa chỉ giao hàng từ buyer.address
        const shippingAddr = buyer.address?.find((a: any) => a._id.toString() === shippingAddressId);
        if (!shippingAddr) {
            return res.status(400).json({ success: false, message: 'Địa chỉ giao hàng không hợp lệ' });
        }

        const bicycle = await Bicycle.findById(bicycleId);
        if (!bicycle || bicycle.status !== 'APPROVED') {
            return res.status(400).json({ success: false, message: 'Xe không khả dụng' });
        }
        if (bicycle.seller._id.toString() === buyer._id.toString()) {
            return res.status(400).json({ success: false, message: 'Không thể mua xe của mình' });
        }

        const existing = await Order.findOne({
            'bicycle._id': bicycleId,
            status: { $nin: ['COMPLETED', 'FUNDS_RELEASED', 'CANCELLED', 'CANCELLED_BY_BUYER', 'REJECTED', 'DEPOSIT_EXPIRED', 'PAYMENT_TIMEOUT'] }
        });
        if (existing) return res.status(400).json({ success: false, message: 'Xe đang có người đặt' });

        const seller = await User.findById(bicycle.seller._id);

        // Pricing
        const originalPrice = bicycle.price;
        const finalPrice = originalPrice - discountAmount;

        // Amount
        // TODO: Team Shipping - hiện tại FE truyền shippingFee, sau này có thể BE tự tính
        const shipping = 0;  // TODO: Team Shipping - uncomment: Number(shippingFee) || 0
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
            shippingAddress: {
                street: shippingAddr.street,
                city: shippingAddr.city,
                district: shippingAddr.district,
                ward: shippingAddr.ward,
            },
            // Lấy địa chỉ từ seller để System biết đến đâu lấy hàng
            pickupAddress: {
                street: seller?.address?.[0]?.street,
                city: seller?.address?.[0]?.city,
                district: seller?.address?.[0]?.district,
                ward: seller?.address?.[0]?.ward,
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
                // shippingFee: shipping,  // TODO: Team Shipping uncomment
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

export const payOrder = async (req: AuthRequest, res: Response) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order || order.buyer._id.toString() !== req.user!._id.toString()) {
            return res.status(404).json({ success: false, message: 'Không tìm thấy' });
        }

        if (order.reservationExpiresAt && new Date() > order.reservationExpiresAt) {
            order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';
            await order.save();
            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });
            return res.status(400).json({ success: false, message: 'Hết thời gian' });
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
                return res.status(400).json({ success: false, message: `Không thể ở ${order.status}` });
        }

        // const buyerWallet = await Wallet.findOne({ userId: req.user!._id });
        // if (!buyerWallet || buyerWallet.balance < buyerPays) {
        //     return res.status(400).json({ success: false, message: 'Số dư không đủ', required: buyerPays });
        // }

        // Option B: Dùng frozenBalance thay vì SystemWallet
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
        // order.transactions.push({ transactionId: txn._id, type: txnType, amount: buyerPays, status: 'SUCCESS', createdAt: new Date() });

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
    const orderData = order.toObject();
    if (isBuyer && !isAdmin) {
        delete orderData.pickupAddress;
    }
    
    res.status(200).json({ success: true, data: orderData });
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

export const reviewOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.buyer._id.toString() !== req.user!._id.toString()) return res.status(403).json({ success: false, message: 'Không có quyền' });
    if (order.status !== 'COMPLETED' && order.status !== 'FUNDS_RELEASED') return res.status(400).json({ success: false, message: 'Chỉ đánh giá đơn hoàn thành' });
    if (order.review) return res.status(400).json({ success: false, message: 'Đã đánh giá' });

    order.review = { rating: req.body.rating, comment: req.body.comment || '', createdAt: new Date() };
    await order.save();
    res.status(200).json({ success: true, data: order });
};

// ============================================
// 🏪 SELLER
// ============================================

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

// ============================================
// 🔧 ADMIN
// ============================================

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
    if (!order || order.status !== 'CONFIRMED') return res.status(400).json({ success: false, message: 'Invalid' });
    order.status = 'WAITING_FOR_PICKUP';
    await order.save();
    res.status(200).json({ success: true, data: order });
};

export const shipOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'WAITING_FOR_PICKUP') return res.status(400).json({ success: false, message: 'Invalid' });
    order.status = 'IN_TRANSIT';
    await order.save();
    res.status(200).json({ success: true, data: order });
};

export const deliverOrder = async (req: AuthRequest, res: Response) => {
    const order = await Order.findById(req.params.id);
    if (!order || order.status !== 'IN_TRANSIT') return res.status(400).json({ success: false, message: 'Invalid' });
    order.status = order.paymentType === 'DEPOSIT_10' ? 'WAITING_REMAINING_PAYMENT' : 'DELIVERED';
    await order.save();
    res.status(200).json({ success: true, data: order });
};
```

---

# 4. CRONJOB

```typescript
// jobs/releaseFunds.ts
import Order from '../models/Order';
import Wallet from '../models/Wallet';
import { ORDER_TIMEOUTS } from '../types/order';

// Helper function
const generateCode = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

export const releaseFundsJob = async () => {
    const threshold = new Date(Date.now() - ORDER_TIMEOUTS.FUNDS_RELEASE);
    const orders = await Order.find({
        status: 'COMPLETED',
        buyerConfirmedAt: { $lte: threshold },
        'amounts.escrowAmount': { $gt: 0 },
    });

    for (const order of orders) {
        // Option B: frozenBalance thay vì SystemWallet
        // const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
        // let sellerWallet = await Wallet.findOne({ userId: order.seller._id });
        // if (!sellerWallet) sellerWallet = await new Wallet({ userId: order.seller._id, balance: 0, frozenBalance: 0 }).save();

        const release = order.amounts.pricing.finalPrice; // Seller nhận 100%
        
        // if (buyerWallet) {
        //     buyerWallet.frozenBalance -= release;
        //     await buyerWallet.save();
        // }
        // sellerWallet.balance += release;
        // await sellerWallet.save();

        order.amounts.releasedAmount = release;
        order.amounts.escrowAmount = 0;
        order.status = 'FUNDS_RELEASED' as any;
        order.fundsReleasedAt = new Date();
        // order.transactions.push({
        //     transactionCode: generateCode('TXN'), type: 'RELEASE', amount: release, status: 'SUCCESS',
        //     createdAt: new Date(), walletId: sellerWallet._id, paymentMethod: 'SYSTEM',
        //     balanceBefore: sellerWallet.balance - release, balanceAfter: sellerWallet.balance,
        //     description: `Release tiền cho Seller - ${order.orderCode}`, paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
        // } as any);
        await order.save();
        
        console.log(`[RELEASE] Order ${order.orderCode}: ${release}đ → Seller`);
    }
};

// app.js
const cron = require('node-cron');
cron.schedule('0 * * * *', releaseFundsJob);  // Chạy mỗi giờ
```

---

# 5. ROUTES & VALIDATIONS

```typescript
// validations/orderValidation.ts
import { z } from 'zod';
export const createOrderSchema = z.object({
    bicycleId: z.string().min(1),
    paymentType: z.enum(['DEPOSIT_10', 'FULL_100']),
    // shippingAddressId: z.string().min(1),  // TODO: Team Shipping uncomment
    // shippingFee: z.number().min(0).optional(),  // TODO: Team Shipping uncomment
    discountAmount: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountReason: z.string().optional(),
});
export const cancelOrderSchema = z.object({ reason: z.string().max(500).optional() });
export const reviewOrderSchema = z.object({ rating: z.number().min(1).max(5), comment: z.string().max(1000).optional() });
```

```typescript
// routes/order.ts
import { Router } from 'express';
import * as ctrl from '../controllers/orderController';
import { verifyToken, requireUser } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';
import { validate } from '../middleware/validate';
import * as v from '../validations/orderValidation';

const router = Router();
router.use(verifyToken, requireUser);

router.post('/', validate(v.createOrderSchema, 'body'), ctrl.createOrder);
router.post('/:id/pay', ctrl.payOrder);
router.get('/me', ctrl.getMyOrders);
router.get('/:id', ctrl.getOrderById);
router.put('/:id/receive', ctrl.receiveOrder);
router.put('/:id/cancel', validate(v.cancelOrderSchema, 'body'), ctrl.cancelOrder);
router.post('/:id/review', validate(v.reviewOrderSchema, 'body'), ctrl.reviewOrder);
router.put('/:id/confirm', ctrl.confirmOrder);
router.put('/:id/reject', validate(v.cancelOrderSchema, 'body'), ctrl.rejectOrder);
router.get('/', requireAdmin, ctrl.getAllOrders);
router.put('/:id/pickup', requireAdmin, ctrl.pickupOrder);
router.put('/:id/ship', requireAdmin, ctrl.shipOrder);
router.put('/:id/deliver', requireAdmin, ctrl.deliverOrder);

export default router;
```

---

# 6. INTEGRATION

```typescript
// types/index.ts
export * from './order';

// app.js
const orderRouter = require('./routes/order').default;
app.use('/api/orders', orderRouter);
```
