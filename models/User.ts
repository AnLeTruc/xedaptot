import mongoose, { Schema } from 'mongoose';
import { IUser, IUserDocument, UserRole } from '../types/index.js';

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
        address: {
            street: String,
            city: String,
            districts: String,
            ward: String,
        },
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
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    {
        timestamps: true,
    }
);

userSchema.index({ roles: 1 });

const User = mongoose.model<IUserDocument>('User', userSchema);

export default User;