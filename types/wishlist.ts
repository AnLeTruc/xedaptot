import { Document, Types } from "mongoose";


export interface IWishlistBicycle {
    title: string;
    price: number;
    primaryImage?: string;
    condition: string;
    status: string;
}


export interface IWishlist {
    userId: Types.ObjectId;
    bicycleId: Types.ObjectId;
    bicycle: IWishlistBicycle;
    createdAt?: Date;
    updatedA?: Date;
}


export interface IWishlistDocument extends IWishlist, Document {
    createdAt: Date;
    updatedAt: Date;
}