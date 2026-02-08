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
    FULL_PAYMENT: 10 * 60 * 60 * 1000,
    DEPOSIT_RESERVATION: 48 * 60 * 60 * 1000,
    FUNDS_RELEASE: 48 * 60 * 60 * 1000,
};


export interface IOrderPricing {
    originalPrice: number;
    discountAmount: number;
    discountPercent: number;
    discountReason?: string;
    finalPrice: number;
};


export interface IOrderAmount {
    total: number;
    deposit: number;
    //  shippingFee: number;
    pricing: IOrderPricing;
    depositPaid: number;
    remainingPaid: number;
    escrowAmount: number;
    releasedAmount: number;
};



// export interface IShippingAddress {
//     street?: string;
//     city?: string;
//     district?: string;
//     ward?: string;
// }



export interface IOrderUser {
    _id: Types.ObjectId;
    fullName: string;
    email: string;
    phone: string;
}


export interface IOrderBicycle {
    _id: Types.ObjectId;
    title: string;
    price: number;
    primaryImage?: string;
    condition?: string;
}


export interface IOrderReview {
    rating: number;
    comment: string;
    createdAt: Date;
}



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



export interface IOrder {
    orderCode: string;
    status: OrderStatus;
    paymentType: PaymentType;
    buyer: IOrderUser;
    seller: IOrderUser;
    bicycle: IOrderBicycle;
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