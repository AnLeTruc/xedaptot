import mongoose, { Schema } from 'mongoose';
import { IWalletDocument } from '../types/wallet';


const walletSchema = new Schema<IWalletDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required'],
            unique: true,
            index: true
        },
        frozenBalance: {
            type: Number,
            default: 0,
            min: [0, 'Frozen balance cannot be negative']
        },
        totalReceived: {
            type: Number,
            default: 0,
            min: [0, 'Total received cannot be negative']
        },
        totalEarn: {
            type: Number,
            default: 0,
            min: [0, 'Total earn cannot be negative']
        },
        totalWithdrawn: {
            type: Number,
            default: 0,
            min: [0, 'Total withdrawn cannot be negative']
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);


// Virtual: số dư khả dụng = totalEarn - totalWithdrawn - frozenBalance
walletSchema.virtual('availableBalance').get(function (this: IWalletDocument) {
    return this.totalEarn - this.totalWithdrawn - this.frozenBalance;
});


const Wallet = mongoose.model<IWalletDocument>('Wallet', walletSchema);
export default Wallet;
