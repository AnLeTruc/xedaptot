import { Request } from 'express';
import { Document } from 'mongoose';

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'INSPECTOR';

//Interface for user data
export interface IUser {
    firebaseUId: string;
    email: string;
    fullName?: string;
    phone?: string;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: Date;
    addresses?: IAddress[];
    avatarUrl?: string;
    roles: UserRole[];
    reputationScore: number;
    isVerified: boolean;
    isActive: boolean;
    authProvider: 'google' | 'email';
    // Email Verification Fields
    emailVerificationToken?: string;
    emailVerificationExpires?: Date;
    // Password Reset Fields
    passwordResetCodeHash?: string;
    passwordResetExpires?: Date;
    passwordResetAttempts?: number;
    passwordResetVerifiedAt?: Date;
    passwordResetTokenHash?: string;
    passwordResetTokenExpires?: Date;

}


export interface IAddress {
    _id?: string;
    label: string;           // "Nhà", "Công ty",...
    street?: string;
    ward?: string;
    district?: string;
    city: string;
    isDefault: boolean;
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

//Brand
export * from './brand';
export * from './bicycle';
export * from './userpackage';
export * from './package';

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

export * from './inspectionReport';
export * from './notification';