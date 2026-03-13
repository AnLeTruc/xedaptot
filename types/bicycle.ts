import { Document, Types } from "mongoose";
import { IAddress } from './address';

export interface IApprovalHistoryEntry {
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    reason?: string;
    actorId?: Types.ObjectId;
    actorName?: string;
    actorRole?: 'ADMIN' | 'SELLER' | 'INSPECTOR';
    createdAt?: Date;
}

export type BicycleCondition = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'FAIR' | 'POOR';

export type BicycleStatus = 'PENDING' | 'APPROVED' | 'RESERVED' | 'SOLD' | 'HIDDEN' | 'REJECTED';

export type InspectionStatus = 'PENDING' | 'REQUESTED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface IBicycleSpecifications {
    yearManufactured?: number;
    frameSize?: string;
    frameMaterial?: string;
    wheelSize?: string;
    gearCount?: number;
    brakeType?: string;
    color?: string;
    weight?: number;
}

export interface IBicycleImage {
    url: string;
    mediaType?: string;
    isPrimary?: boolean;
    displayOrder?: number;
}

export interface IBicycleSeller {
    _id: Types.ObjectId;
    fullName: string;
    avatarUrl: string;
    reputationScore: number;
}

export interface IBicycleCategory {
    _id: Types.ObjectId;
    name: string;
}

export interface IBicycleBrand {
    _id: Types.ObjectId;
    name: string;
}

export interface IBicycleModelRef {
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
    expiresAt?: Date;

    inspectionStatus?: InspectionStatus;
    assignedInspectorId?: Types.ObjectId;
    inspectionReportId?: Types.ObjectId;

    category: IBicycleCategory;
    brand?: IBicycleBrand;
    model?: IBicycleModelRef;
    seller: IBicycleSeller;
    specifications?: IBicycleSpecifications;
    location?: IAddress;
    images?: IBicycleImage[];
    rejectionReason?: string;
    approvalHistory?: IApprovalHistoryEntry[];
    hasChangedSinceRejection?: boolean;
}

export interface IBicycleDocument extends IBicycle, Omit<Document, 'model'> {
    createdAt: Date;
    updatedAt: Date;
}