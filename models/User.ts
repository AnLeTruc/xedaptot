import mongoose, { Schema } from 'mongoose';
import { IUser, IUserDocument, UserRole } from '../types';
import { addressSubSchema } from './schemas/addressSchema';

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
        gender: {
            type: String,
            enum: ['male', 'female', 'other'],
        },
        dateOfBirth: {
            type: Date,
        },
        addresses: [{
            label: {
                type: String,
                required: true,
                trim: true
            },
            isDefault: {
                type: Boolean,
                default: false
            },
            ...addressSubSchema
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
            max: 5,
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
        passwordResetTokenHash: {
            type: String,
            select: false
        },
        passwordResetTokenExpires: {
            type: Date,
            select: false
        },
        passwordChangedAt: {
            type: Date,
            select: false
        },
        // KYC fields
        kycStatus: {
            type: String,
            enum: ['NONE', 'PENDING', 'VERIFIED', 'REJECTED'],
            default: 'NONE'
        },
        kycFullName: {
            type: String,
            trim: true
        },
        kycIdNumber: {
            type: String,
            trim: true
        },
        kycIdNumberMasked: {
            type: String,
            trim: true
        },
        kycDob: {
            type: String,
            trim: true
        },
        kycAddress: {
            type: String,
            trim: true
        },
        kycVerifiedAt: {
            type: Date
        },
        kycData: {
            type: Schema.Types.Mixed,
            select: false
        },
        isOnline: {
            type: Boolean,
            default: false
        },
        lastActiveAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true,
    }
);

userSchema.index({ roles: 1 });

const User = mongoose.model<IUserDocument>('User', userSchema);

export default User;