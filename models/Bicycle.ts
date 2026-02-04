import mongoose, { Schema } from 'mongoose';
import { IBicycle, IBicycleDocument } from '../types/bicycle';


const bicycleSchema = new Schema<IBicycleDocument>(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters']
        },
        description: {
            type: String,
            trim: true,
            maxlength: [5000, 'Description cannot exceed 5000 character']
        },
        price: {
            type: Number,
            required: [true, 'Price is required'],
            min: [0, 'Price cannot be negative']
        },
        originalPrice: {
            type: Number,
            min: [0, 'Original price cannot be negative']
        },
        condition: {
            type: String,
            enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'],
            required: [true, 'Condition is required']
        },
        usageMonths: {
            type: Number,
            min: [0, 'Usage months cannot be negative']
        },
        viewCount: {
            type: Number,
            default: 0,
            min: 0
        },
        status: {
            type: String,
            enum: ['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED'],
            default: 'PENDING'
        },
        isInspected: {
            type: Boolean,
            default: false
        },
        isFeatured: {
            type: Boolean,
            default: false
        },
        // Inspection fields
        inspectionStatus: {
            type: String,
            enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
            default: 'PENDING',
            index: true
        },
        assignedInspectorId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        },
        inspectionReportId: {
            type: Schema.Types.ObjectId,
            ref: 'InspectionReport'
        },
        expiresAt: {
            type: Date
        },
        category: {
            _id: {
                type: Schema.Types.ObjectId,
                ref: 'Category',
                required: [true, 'Category ID is required']
            },
            name: {
                type: String,
                required: [true, 'Category name is required']
            }
        },
        brand: {
            _id: {
                type: Schema.Types.ObjectId,
                ref: 'Brand',
                required: [true, 'Brand ID is required']
            },
            name: {
                type: String,
                required: [true, 'Brand name is required']
            }
        },
        seller: {
            _id: {
                type: Schema.Types.ObjectId,
                ref: 'User',
                required: [true, 'Seller ID is required']
            },
            fullName: {
                type: String,
                required: [true, 'Seller name is required']
            },
            avatarUrl: {
                type: String,
                required: [true, 'Seller avatar is required']
            },
            reputationScore: {
                type: Number,
                default: 0,
                min: 0
            },
        },
        specifications: {
            yearManufactured: Number,
            frameSize: String,
            frameMaterial: String,
            wheelSize: String,
            gearCount: Number,
            brakeType: String,
            color: String,
            weight: Number
        },
        location: {
            address: String,
            city: String,
            coordinates: {
                type: {
                    type: String,
                    enum: ['Point'],
                    default: 'Point'
                },
                coordinates: {
                    type: [Number],
                    index: '2dsphere'
                }
            }
        },
        images: [{
            url: {
                type: String,
                required: [true, 'Image URL is required']
            },
            mediaType: {
                type: String,
                enum: ['image', 'video'],
                default: 'image'
            },
            isPrimary: {
                type: Boolean,
                default: false
            },
            displayOrder: {
                type: Number,
                default: 0
            }
        }]
    },
    {
        timestamps: true
    }
);

bicycleSchema.index({ 'location.coordinates': '2dsphere' });


const Bicycle = mongoose.model<IBicycleDocument>('Bicycle', bicycleSchema);
export default Bicycle;