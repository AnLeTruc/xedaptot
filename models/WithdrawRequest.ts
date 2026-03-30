import mongoose, { Schema } from 'mongoose';
import { IWithdrawRequestDocument } from '../types/wallet';


const withdrawRequestSchema = new Schema<IWithdrawRequestDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required']
        },
        walletId: {
            type: Schema.Types.ObjectId,
            ref: 'Wallet',
            required: [true, 'Wallet ID is required']
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [10000, 'Minimum withdraw amount is 10,000đ']
        },
        bankInfo: {
            bankName: {
                type: String,
                required: [true, 'Bank name is required'],
                trim: true
            },
            accountNumber: {
                type: String,
                required: [true, 'Account number is required'],
                trim: true
            },
            accountName: {
                type: String,
                required: [true, 'Account name is required'],
                trim: true
            }
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'],
            default: 'PENDING'
        },
        type: {
            type: String,
            enum: ['AUTO', 'MANUAL'],
            required: [true, 'Withdraw type is required']
        },
        processedAt: Date,
        processedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        rejectedReason: {
            type: String,
            maxlength: [500, 'Rejected reason cannot exceed 500 characters']
        },
        transferReference: {
            type: String,
            trim: true,
            maxlength: [100, 'Transfer reference cannot exceed 100 characters']
        }
    },
    {
        timestamps: true
    }
);


// Compound indexes
withdrawRequestSchema.index({ userId: 1, status: 1, createdAt: -1 });
withdrawRequestSchema.index({ status: 1, createdAt: -1 });


const WithdrawRequest = mongoose.model<IWithdrawRequestDocument>('WithdrawRequest', withdrawRequestSchema);
export default WithdrawRequest;
