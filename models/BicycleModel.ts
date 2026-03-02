import mongoose, { Schema } from 'mongoose';
import { IBicycleModelDocument } from '../types';


const bicycleModelSchema = new Schema<IBicycleModelDocument>(
    {
        name: {
            type: String,
            required: [true, 'Model name is required'],
            trim: true,
            maxlength: [200, 'Model name cannot exceed 200 characters']
        },
        brand: {
            _id: {
                type: Schema.Types.ObjectId,
                ref: 'Brand',
                required: [true, 'Brand is required']
            },
            name: {
                type: String,
                required: [true, 'Brand name is required'],
                trim: true,
                maxlength: [100, 'Brand name cannot exceed 100 characters']
            }
        },
        year: {
            type: Number,
            min: [1900, 'Year must be after 1900']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [2000, 'Description cannot exceed 2000 characters']
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


bicycleModelSchema.index({ 'brand._id': 1 });
bicycleModelSchema.index({ 'brand._id': 1, name: 1 }, { unique: true });
bicycleModelSchema.index({ isActive: 1 });


const BicycleModel = mongoose.model<IBicycleModelDocument>('BicycleModel', bicycleModelSchema);

export default BicycleModel;