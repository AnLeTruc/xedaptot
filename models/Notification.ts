import mongoose, { Schema } from 'mongoose';
import { INotificationDocument } from '../types/notification';

const notificationSchema = new Schema<INotificationDocument>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    type: {
        type: String,
        enum: ['INSPECTION_ASSIGNED', 'NEW_BICYCLE_POSTED', 'INSPECTION_COMPLETED', 'GENERAL'],
        required: [true, 'Notification type is required']
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
        maxlength: [1000, 'Content cannot exceed 1000 characters']
    },
    isRead: {
        type: Boolean,
        default: false
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

const Notification = mongoose.model<INotificationDocument>('Notification', notificationSchema);

export default Notification;
