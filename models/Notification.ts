import mongoose, { Schema } from 'mongoose';
import { INotificationDocument, NotificationType } from '../types/notification';

const NOTIFICATION_TYPES: NotificationType[] = [
    'ACCOUNT',
    'PROFILE',
    'LISTING',
    'ORDER',
    'WALLET',
    'CHAT',
    'SUBSCRIPTION',
    'INSPECTION_ASSIGNED',
    'INSPECTION_REQUESTED',
    'NEW_BICYCLE_POSTED',
    'INSPECTION_COMPLETED',
    'GENERAL'
];

const notificationSchema = new Schema<INotificationDocument>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    type: {
        type: String,
        enum: NOTIFICATION_TYPES,
        required: [true, 'Notification type is required']
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    isRead: {
        type: Boolean,
        default: false
    },
    url: {
        type: String,
        maxlength: [500, 'URL cannot exceed 500 characters']
    },
    metadata: {
        bicycleId: {
            type: Schema.Types.ObjectId,
            ref: 'Bicycle'
        },
        inspectionReportId: {
            type: Schema.Types.ObjectId,
            ref: 'InspectionReport'
        },
        inspectorId: {
            type: Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// Index for efficient queries
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model<INotificationDocument>('Notification', notificationSchema);

export default Notification;
