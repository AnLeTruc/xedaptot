import { Document, Types } from 'mongoose';

export type BankAccountStatus = 'ACTIVE' | 'INACTIVE';

export interface IBankAccount {
    userId: Types.ObjectId;
    bankName: string;           // Ví dụ: "Vietcombank"
    bankNameNormalized: string; // Khóa chuẩn hoá (phục vụ unique toàn hệ thống)
    accountNumber: string;
    accountNumberEncrypted: string;
    accountNumberMasked: string;
    accountOwner: string;       // Phải khớp với tên KYC
    isDefault: boolean;         // Mặc định để rút tiền
    status: BankAccountStatus;
    addedAt: Date;
}

export interface IBankAccountDocument extends IBankAccount, Document {
    createdAt: Date;
    updatedAt: Date;
}
