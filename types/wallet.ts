import { Document, Types } from 'mongoose';


//Transaction Types
export type TransactionType =
    | 'DEPOSIT'         // Nạp tiền vào ví (VNPay)
    | 'ESCROW_IN'       // Buyer thanh toán → escrow
    | 'ESCROW_RELEASE'  // Escrow → seller wallet
    | 'REFUND'          // Hoàn tiền cho buyer
    | 'FORFEIT'         // Buyer hủy sau confirm → seller nhận cọc
    | 'WITHDRAW';       // Seller rút tiền


export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED';


export type WithdrawStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';


export interface IWallet {
    userId: Types.ObjectId;
    frozenBalance: number;
    totalReceived: number;
    totalEarn: number;
    totalWithdrawn: number;
}

export interface IWalletDocument extends IWallet, Document {
    createdAt: Date;
    updatedAt: Date;
    availableBalance: number;
}

export interface ITransaction {
    transactionCode: string;
    paymentMethod: string;
    data?: any;
    orderId?: Types.ObjectId;
    walletId: Types.ObjectId;
    type: TransactionType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    description: string;
    paymentGateway?: string;
    gatewayTransactionId?: string;
    gatewayResponseCode?: string;
}

export interface ITransactionDocument extends ITransaction, Document {
    createdAt: Date;
    updatedAt: Date;
}

export interface IBankInfo {
    bankName: string;
    accountNumber: string;
    accountName: string;
}

export interface IWithdrawRequest {
    userId: Types.ObjectId;
    walletId: Types.ObjectId;
    amount: number;
    bankInfo: IBankInfo;
    status: WithdrawStatus;
    processedAt?: Date;
    processedBy?: Types.ObjectId;
    rejectedReason?: string;
}

export interface IWithdrawRequestDocument extends IWithdrawRequest, Document {
    createdAt: Date;
    updatedAt: Date;
}
