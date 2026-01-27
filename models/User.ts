import mongoose, { Schema } from 'mongoose';
import { IUser, IUserDocument, UserRole } from '../types';

const userSchema = new Schema<IUserDocument>(
    {
        firebaseUId: {
            type: String,
            required: [true, 'Firebase UID is required'],
            unique: true,
            index: true,
        },
        email: {
            type: String,
            required: [true, 'Email is requied'],
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            trim: true,
        },
        phone: {
            type: String,
            trim: true,
        },
        addresses: [{
            label: {
                type: String,
                required: true,
                trim: true
            },
            street: {
                type: String,
                trim: true
            },
            ward: {
                type: String,
                trim: true
            },
            district: {
                type: String,
                trim: true
            },
            city: {
                type: String,
                required: true
            },
            isDefault: {
                type: Boolean,
                default: false
            }
        }],
        avatarUrl: {
            type: String,
            trim: true
        },
        roles: {
            type: [String],
            enum: ['BUYER', 'SELLER', 'ADMIN', 'INSPECTOR'],
            default: ['BUYER'],
        },
        reputationScore: {
            type: Number,
            default: 0,
            min: 0,
        },
        isVerified: {
            type: Boolean,
            default: false,
        },
        emailVerificationToken: {
            type: String,
            select: false
        },
        emailVerificationExpires: {
            type: Date,
            select: false
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        authProvider: {
            type: String,
            enum: ['google', 'email'],
            required: [true, 'Auth provider is required'],
        },
        passwordResetCodeHash: {
            type: String,
            select: false
        },
        passwordResetExpires: {
            type: Date,
            select: false
        },
        passwordResetAttempts: {
            type: Number,
            select: false,
            default: 0
        },
        passwordResetVerifiedAt: {
            type: Date,
            select: false
        },
        passwordResetTokenHash:{
            type: String,
            select: false
        },
        passwordResetTokenExpires:{
            type: Date,
            select: false
        }
    },
    {
        timestamps: true,
    }
);

userSchema.index({ roles: 1 });

const User = mongoose.model<IUserDocument>('User', userSchema);

export default User;