import mongoose, { Schema } from 'mongoose';
import { IWishlistDocument } from '../types/wishlist';
import { truncate } from 'node:fs';


const wishlistBicycleSchema = new Schema(
    {
        _id: {
            type: Schema.Types.ObjectId,
            ref: 'Bicycle',
            required: true
        },
        title: {
            type: String,
            rquired: true
        },
        price: {
            type: Number,
            required: true
        },
        primaryImage: {
            type: String,
        },
        condition: {
            type: String,
        },
        status: {
            type: String,
            required: true
        }
    }, { _id: false }
);


const wishlistSchema = new Schema(
    {
        userId: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User Id is required'],
            index: true
        },
        bicyclesId: {
            type: [Schema.Types.ObjectId],
            ref: 'Bicycle',
            required: [true, 'Bicycle Id is required'],
            index: true
        },
        bicycles: {
            type: [wishlistBicycleSchema],
            required: [true, 'Bicycle is required']
        }
    }, {
    timestamps: true
}
);




wishlistSchema.index({ userId: 1, bicyclesId: 1 }, { unique: true });

export default mongoose.model<IWishlistDocument>('Wishlist', wishlistSchema);

