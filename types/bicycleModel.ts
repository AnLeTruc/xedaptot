import { Document, Types } from 'mongoose';

export interface IBicycleModel {
    name: string;
    brand: {
        _id: Types.ObjectId;
        name: string;
    };
    year?: number;
    description?: string;
    imageUrl?: string;
    isActive: boolean;
}

export interface IBicycleModelDocument extends IBicycleModel, Document {
    createdAt: Date;
    updatedAt: Date;
}