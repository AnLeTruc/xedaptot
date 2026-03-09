import mongoose, { Schema } from 'mongoose';
import { ITransactionDocument } from '../types/wallet';


const transactionSchema = new Schema<ITransactionDocument>(
    {
        transactionCode: {
            type: String,
            required: [true, 'Transaction code is required'],
            unique: true,
            index: true
        },
        paymentMethod: {
            type: String,
            enum: ['WALLET', 'SYSTEM', 'BANK_TRANSFER', 'VNPAY'],
            default: 'WALLET'
        },
        data: {
            type: Schema.Types.Mixed
        },
        orderId: {
            type: Schema.Types.ObjectId,
            ref: 'Order'
        },
        walletId: {
            type: Schema.Types.ObjectId,
            ref: 'Wallet',
            required: [true, 'Wallet ID is required']
        },
        type: {
            type: String,
            enum: ['ESCROW_IN', 'ESCROW_RELEASE', 'REFUND', 'FORFEIT', 'WITHDRAW', 'DEPOSIT', 'PACKAGE_PURCHASE'],
            required: [true, 'Transaction type is required']
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative']
        },
        balanceBefore: {
            type: Number,
            required: true
        },
        balanceAfter: {
            type: Number,
            required: true
        },
        description: {
            type: String,
            maxlength: [500, 'Description cannot exceed 500 characters']
        },
        paymentGateway: String,
        gatewayTransactionId: String,
        gatewayResponseCode: String
    },
    {
        timestamps: true
    }
);


// Compound indexes for fast queries
transactionSchema.index({ walletId: 1, createdAt: -1 });
transactionSchema.index({ orderId: 1 });


const Transaction = mongoose.model<ITransactionDocument>('Transaction', transactionSchema);
export default Transaction;
