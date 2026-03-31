import { Request } from 'express';
import { Document } from 'mongoose';
import { IUserAddress } from './address';

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'INSPECTOR';

export type KycStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface IUser {
    firebaseUId: string;
    email: string;
    fullName?: string;
    phone?: string;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: Date;
    addresses?: IUserAddress[];
    avatarUrl?: string;
    roles: UserRole[];
    reputationScore: number;
    isVerified: boolean;
    isActive: boolean;
    authProvider: 'google' | 'email';
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    passwordResetCodeHash?: string;
    passwordResetExpires?: Date;
    passwordResetAttempts?: number;
    passwordResetVerifiedAt?: Date;
    passwordResetTokenHash?: string;
    passwordResetTokenExpires?: Date;
    passwordChangedAt?: Date;
    isOnline?: boolean;
    lastActiveAt?: Date;
    // KYC fields
    kycStatus?: KycStatus;
    kycFullName?: string;       // Tên trên CCCD
    kycIdNumber?: string;       // Số CCCD
    kycIdNumberMasked?: string;
    kycDob?: string;            // Ngày sinh trên CCCD
    kycAddress?: string;        // Địa chỉ trên CCCD
    kycVerifiedAt?: Date;
    kycData?: any;              // Raw response từ FPT.AI
    
}

//Interface Mongoose Document
export interface IUserDocument extends IUser, Document {
    createdAt: Date;
    updatedAt: Date;
}

//Interface Express Request
export interface AuthRequest extends Request {
    user?: IUserDocument;
    firebaseUser?: {
        uid: string;
        email?: string;
        name?: string;
        picture?: string;
    };
};

export interface ICategory {
    name: string;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
}
export interface ICategoryDocument extends ICategory, Document {
    createdAt: Date;
    updatedAt: Date;
}

export * from './brand';
export * from './bicycle';
export * from './address';
export * from './userpackage';
export * from './package';
export * from './inspectionReport';
export * from './notification';
export * from './bicycleModel';
export * from './message';
export * from './conversation';
export * from './restrictedWord';
export * from './summary';
export * from './disputes';
export * from './bankAccount';