import mongoose, { Schema } from 'mongoose';
import { IPackageDocument } from '../types/package';


const packageSchema = new Schema<IPackageDocument>(
    {
        name: {
            type: String,
            required: [true, 'Package name is required'],
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters']
        },
        code: {
            type: String,
            required: [true, 'Package code is required'],
            uppercase: true,
            trim: true,
            unique: true,
            maxlength: [20, 'Code cannot exceed 20 characters']
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative']
        },
        postLimit: {
            type: Number,
            required: [true, 'Post limit is required'],
            min: [1, 'Post limit must be at least 1']
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);


packageSchema.index({ code: 1 });
packageSchema.index({ isActive: 1 });

const Package = mongoose.model<IPackageDocument>('Package', packageSchema);
export default Package;   