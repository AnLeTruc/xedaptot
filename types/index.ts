import { Request } from 'express';
import { Document } from 'mongoose';

export type UserRole = 'BUYER' | 'SELLER' | 'ADMIN' | 'INSPECTOR';

//Interface for user data
export interface IUser {
    firebaseUId: string;
    email: string;
    fullName?: string;
    phone?: string;
    address?: {
        street?: string;
        city?: string;
        district?: string;
        ward?: string;
    };
    avatarUrl?: string;
    roles: UserRole[];
    reputationScore: number;
    isVerified: boolean;
    isActive: boolean;
    authProvider: 'google' | 'email';
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