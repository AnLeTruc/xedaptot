import mongoose, { Schema } from 'mongoose';
import { ICategoryDocument } from '../types';

const categorySchema = new Schema<ICategoryDocument>(
    {
        name: {
            type: String,
            required: [true, 'Category name is required'],
            unique: true,
            trim: true,
            maxlength: [100, 'Name cannot exceed 100 characters']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters']
        },
        imageUrl: {
            type: String,
            trim: true
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

// Index để tìm kiếm nhanh
categorySchema.index({ name: 'text' });
categorySchema.index({ isActive: 1 });

const Category = mongoose.model<ICategoryDocument>('Category', categorySchema);

export default Category;