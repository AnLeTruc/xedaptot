import { Document, Types } from "mongoose";

// Notification Types
export type NotificationType =
    | 'INSPECTION_ASSIGNED'      // Admin assigned inspection to inspector
    | 'NEW_BICYCLE_POSTED'       // New bicycle available for inspection
    | 'INSPECTION_COMPLETED'     // Inspection completed (for seller)
    | 'GENERAL';

// Notification Interface
export interface INotification {
    userId: Types.ObjectId;
    type: NotificationType;
    title: string;
    content: string;
    isRead: boolean;
    metadata?: {
        bicycleId?: Types.ObjectId;
        inspectionReportId?: Types.ObjectId;
        inspectorId?: Types.ObjectId;
    };
}

export interface INotificationDocument extends INotification, Document {
    createdAt: Date;
    updatedAt: Date;
}
