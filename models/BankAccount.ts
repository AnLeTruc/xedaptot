import mongoose, { Schema } from 'mongoose';
import { IBankAccountDocument } from '../types/bankAccount';


const bankAccountSchema = new Schema<IBankAccountDocument>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID là bắt buộc'],
            index: true
        },
        bankName: {
            type: String,
            required: [true, 'Tên ngân hàng là bắt buộc'],
            trim: true,
            maxlength: [100, 'Tên ngân hàng không vượt quá 100 ký tự']
        },
        accountNumber: {
            type: String,
            required: [true, 'Số tài khoản là bắt buộc'],
            trim: true,
            maxlength: [30, 'Số tài khoản không vượt quá 30 ký tự']
        },
        accountOwner: {
            type: String,
            required: [true, 'Tên chủ tài khoản là bắt buộc'],
            trim: true,
            maxlength: [100, 'Tên chủ tài khoản không vượt quá 100 ký tự']
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        status: {
            type: String,
            enum: ['ACTIVE', 'INACTIVE'],
            default: 'ACTIVE'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Unique constraint: same user cannot add same account number at same bank twice
bankAccountSchema.index({ userId: 1, bankName: 1, accountNumber: 1 }, { unique: true });
bankAccountSchema.index({ userId: 1, status: 1 });


// Pre-save: ensure only 1 default per user
bankAccountSchema.pre('save', async function () {
    if (this.isDefault && this.isModified('isDefault')) {
        await mongoose.model('BankAccount').updateMany(
            { userId: this.userId, _id: { $ne: this._id }, isDefault: true },
            { $set: { isDefault: false } }
        );
    }
});


const BankAccount = mongoose.model<IBankAccountDocument>('BankAccount', bankAccountSchema);
export default BankAccount;
