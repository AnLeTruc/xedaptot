import { Document, Types } from "mongoose";

// Notification Types
export type NotificationType =
    | 'INSPECTION_ASSIGNED'      // Admin assigned inspection to inspector
    | 'INSPECTION_REQUESTED'     // Seller requested inspection for bicycle
    | 'NEW_BICYCLE_POSTED'       // New bicycle available for inspection
    | 'INSPECTION_COMPLETED'     // Inspection completed (for seller)
    | 'GENERAL'
    | 'ACCOUNT'
    | 'PROFILE'
    | 'LISTING'
    | 'ORDER'
    | 'WALLET'
    | 'CHAT'
    | 'SUBSCRIPTION';

// Notification Interface
export interface INotification {
    userId: Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    url?: string;
    isRead: boolean;
    metadata?: {
        bicycleId?: Types.ObjectId;
        inspectionReportId?: Types.ObjectId;
        inspectorId?: Types.ObjectId;
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface INotificationDocument extends INotification, Document {
    createdAt: Date;
    updatedAt: Date;
}
