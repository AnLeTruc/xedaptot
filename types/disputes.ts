import { Document, Types } from 'mongoose';


export interface IDisputeUser {
    _id: Types.ObjectId;
    fullName: string;
    phone: string;
}


export interface IRespondentUser {
    _id: Types.ObjectId;
    fullName: string;
    phone: string;
}


export type IDisputeType =
    | 'ITEM_NOT_AS_DESCRIBED'
    | 'ITEM_NOT_RECEIVED'
    | 'DAMAGED_ITEM'
    | 'FAKE_ITEM'
    | 'OTHER';


export type IDisputeStatus =
    | 'PENDING'
    | 'UNDER_REVIEW'    // admin đang xem xét
    | 'RESOLVED'
    | 'REJECTED';



export type IDisputeResolution =
    | 'REFUND_BUYER'
    | 'RELEASE_SELLER'
    | 'NONE';           // Ko có quyết định về tiền bạc -  hòa nhau


export interface IDispute {
    _id: Types.ObjectId;
    disputeType: IDisputeType;
    status: IDisputeStatus;
    resolution: IDisputeResolution;
    createAt?: Date;
    resolveAt?: Date;   // thời gian admin bấm resolve
    complainant: IDisputeUser;      // người kiện
    respondent: IRespondentUser;        // ng bị kiện
    orderId: Types.ObjectId;
    userId: Types.ObjectId;
    reason: string;
    evidenceImage?: string[];
}



export interface IDisputeDocument extends IDispute, Document {
    createdAt: Date;
    updatedAt: Date;
}
