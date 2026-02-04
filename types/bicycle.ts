import { Document, Types } from "mongoose";

export type BicycleCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

export type BicycleStatus = 'PENDING' | 'APPROVED' | 'SOLD' | 'HIDDEN' | 'REJECTED';

export type InspectionStatus = 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';





// specifications - thông số kỹ thuật
export interface IBicycleSpecifications {
    yearManufactured?: number; // năm sx
    frameSize?: string; // kích thước khung
    frameMaterial?: string;// chất liệu khung
    wheelSize?: string;  // Kích thước bánh
    gearCount?: number;  // số cấp số
    brakeType?: string; // loại phanh
    color?: string; // màu sắc
    weight?: number; // trọng lượng
}


// coodinates - tọa độ
export interface IBicycleCoordinates {
    type?: string;
    coordinates?: number[];
}



// location
export interface IBicycleLocation {
    address?: string;
    city?: string;
    coordinates?: IBicycleCoordinates;
}



// images [{}]
export interface IBicycleImage {
    url: string;
    mediaType?: string;
    isPrimary?: boolean;
    displayOrder?: number;
}


// seller
export interface IBicycleSeller {
    _id: Types.ObjectId;
    fullName: string;
    avatarUrl: string;
    reputationScore: number;
}




// category 
export interface IBicycleCategory {
    _id: Types.ObjectId;
    name: string;
}



// brand
export interface IBicycleBrand {
    _id: Types.ObjectId;
    name: string;
}


export interface IBicycle {
    title: string;
    description?: string;
    price: number;
    originalPrice?: number;
    condition: BicycleCondition;
    usageMonths?: number;
    viewCount: number;
    status: BicycleStatus;
    isInspected: boolean;
    isFeatured: boolean;
    expiresAt?: Date;

    // Inspection fields
    inspectionStatus?: InspectionStatus;
    assignedInspectorId?: Types.ObjectId;
    inspectionReportId?: Types.ObjectId;

    // Embedded objects
    category: IBicycleCategory;
    brand?: IBicycleBrand;
    seller: IBicycleSeller;
    specifications?: IBicycleSpecifications;
    location?: IBicycleLocation;
    images?: IBicycleImage[];
}

export interface IBicycleDocument extends IBicycle, Document {
    createdAt: Date;
    updatedAt: Date;
}