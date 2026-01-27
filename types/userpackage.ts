import { Document, Types } from "mongoose";


export type UserPackageStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface IUserPackageSnapshot {
    _id: Types.ObjectId;
    name: string;
    code: string;
    postLimit: number;
    durationDays: number;
    isFeatured: boolean;
}

export interface IUserPackage {
    userId: Types.ObjectId;
    packageId: Types.ObjectId;
    package: IUserPackageSnapshot;
    postedUsed: number;
    postRemaining: number;
    status: UserPackageStatus;
    purchasedAt: Date;
    transactionId?: Types.ObjectId;
}


export interface IUserPackageDocument extends IUserPackage, Document {
    createdAt: Date;
    updatedAt: Date;
}