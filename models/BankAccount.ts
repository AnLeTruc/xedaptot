import mongoose, { Schema } from 'mongoose';
import { IBankAccountDocument } from '../types/bankAccount';
import { normalizeBankName } from '../utils/nameUtils';


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
        bankNameNormalized: {
            type: String,
            required: [true, 'Tên ngân hàng (chuẩn hoá) là bắt buộc'],
            trim: true,
            maxlength: [128, 'Tên ngân hàng (chuẩn hoá) không vượt quá 128 ký tự'],
            index: true,
            select: false
        },
        accountNumber: {
            type: String,
            required: [true, 'Số tài khoản là bắt buộc'],
            trim: true,
            // NOTE: this is stored as a keyed hash (not plaintext)
            select: false,
            maxlength: [128, 'Số tài khoản không vượt quá 128 ký tự']
        },
        accountNumberEncrypted: {
            type: String,
            required: [true, 'Số tài khoản (mã hoá) là bắt buộc'],
            select: false,
            trim: true
        },
        accountNumberMasked: {
            type: String,
            required: [true, 'Số tài khoản (ẩn) là bắt buộc'],
            trim: true,
            maxlength: [64, 'Số tài khoản (ẩn) không vượt quá 64 ký tự']
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

// Unique constraint (GLOBAL): 1 bank account number (per bank) can only belong to 1 user system-wide.
// Use partial index to avoid index-build failures on older documents that haven't been backfilled yet.
bankAccountSchema.index(
    { bankNameNormalized: 1, accountNumber: 1 },
    {
        unique: true,
        partialFilterExpression: {
            bankNameNormalized: { $type: 'string', $ne: '' },
            accountNumber: { $type: 'string', $ne: '' }
        }
    }
);

// Keep a user-scoped index for query efficiency (optional; not unique).
bankAccountSchema.index({ userId: 1, bankNameNormalized: 1, accountNumber: 1 });
bankAccountSchema.index({ userId: 1, status: 1 });


bankAccountSchema.pre('validate', function () {
    if (this.bankName && (!this.bankNameNormalized || this.isModified('bankName'))) {
        (this as any).bankNameNormalized = normalizeBankName(this.bankName);
    }
});


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
