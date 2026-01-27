import mongoose, { Schema } from 'mongoose';
import { IUserPackageDocument } from '../types/userpackage';


const userPackageSchema = new Schema<IUserPackageDocument>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    packageId: {
        type: Schema.Types.ObjectId,
        ref: 'UserPackage',
        required: [true, 'Package ID is required'],
        index: true
    },
    package: {
        _id: {
            type: Schema.Types.ObjectId,
            required: [true, 'Package ID is required'],
        },
        name: {
            type: String,
            required: [true, 'Package name is required'],
        },
        code: {
            type: String,
            required: [true, 'Package code is required'],
        },
        postLimit: {
            type: Number,
            required: [true, 'Package post limit is required'],
            min: [0, 'Package post limit cannot be negative'],
        },
        durationDays: {
            type: Number,
            required: [true, 'Package duration days is required'],
            min: [1, 'Package duration days cannot be less than 1'],
        },
        isFeatured: {
            type: Boolean,
            default: false
        }
    },
    postedUsed: {
        type: Number,
        default: 0,
        min: [0, 'Posted used cannot be negative']
    },
    postRemaining: {
        type: Number,
        required: [true, 'Post remaining is required'],
        min: [0, 'Posted remaining cannot be negative']
    },
    status: {
        type: String,
        enum: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
        default: 'ACTIVE',
        index: true
    },
    purchasedAt: {
        type: Date,
        default: Date.now
    },
    transactionId: {
        type: Schema.Types.ObjectId,
        ref: 'Transaction'
    }
},
    { timestamps: true }
);


userPackageSchema.index({ userId: 1, status: 1 });
const UserPackage = mongoose.model<IUserPackageDocument>('UserPackage', userPackageSchema);

export default UserPackage;