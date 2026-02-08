import mongoose, { Schema } from 'mongoose';
import { IOrderDocument } from '../types/order';


// const shippingAddressSchema = {
//     street: String,
//     city: String,
//     district: String,
//     ward: String,
// };


const pricingSchema = {
    originalPrice: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountReason: String,
    finalPrice: { type: Number, required: true },
};


const orderSchema = new Schema<IOrderDocument>({
    orderCode: { type: String, required: true, unique: true, index: true },
    status: {
        type: String,
        enum: [
            'RESERVED_FULL', 'RESERVED_DEPOSIT', 'DEPOSIT_EXPIRED',
            'PAYMENT_TIMEOUT', 'WAITING_SELLER_CONFIRMATION',
            'CONFIRMED', 'REJECTED', 'WAITING_FOR_PICKUP',
            'IN_TRANSIT', 'DELIVERED', 'WAITING_REMAINING_PAYMENT',
            'COMPLETED', 'FUNDS_RELEASED', 'CANCELLED',
            'CANCELLED_BY_BUYER', 'DISPUTED'
        ],
        default: 'RESERVED_DEPOSIT'
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