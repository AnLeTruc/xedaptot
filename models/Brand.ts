import mongoose, { Schema } from 'mongoose';
import { IBrandDocument } from '../types/index';

const brandSchema = new Schema<IBrandDocument>(
    {
        name: {
            type: String,
            required: [true, 'Brand name is required'],
            unique: true,
            trim: true
        },
        country: {
            type: String,
            trim: true
        },
        isActive: {
            type: Boolean,
            default: true,
        }
    }, { timestamps: true }
);

//Index
brandSchema.index({ isActive: 1 });

const Brand = mongoose.model<IBrandDocument>('Brand', brandSchema);

export default Brand;
