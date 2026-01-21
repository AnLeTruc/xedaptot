import { Document } from "mongoose";

//Inteface Brand 
export interface IBrand {
    name: string;
    country?: string;
    imageUrl?: string;
    isActive: boolean;
}

//Interface mongoose document
export interface IBrandDocument extends IBrand, Document {
    createdAt: Date;
    updatedAt: Date;
}
