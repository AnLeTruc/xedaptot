import { Request } from 'express';
import { Document } from 'mongoose';
import { IUserAddress } from './address';

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'INSPECTOR';

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

export * from './brand';
export * from './bicycle';
export * from './address';
export * from './disputes';
//export * from './userpackage';
export * from './package';
export * from './violationReport';

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
export * from './bicycleModel';