import { Document } from "mongoose";

export interface IPackage {
    name: string;
    code: string;
    price: number;
    postLimit: number;
    isActive: boolean;
}


export interface IPackageDocument extends IPackage, Document {
    createdAt: Date;
    updatedAt: Date;
}