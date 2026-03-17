import mongoose, { Schema } from 'mongoose';
import { IDeviceTokenDocument } from '../types/deviceToken';

const deviceTokenSchema = new Schema<IDeviceTokenDocument>({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User ID is required'],
        index: true
    },
    fcmToken: {
        type: String,
        required: [true, 'FCM Token is required']
    },
    deviceType: {
        type: String,
        enum: ['ios', 'android', 'web'],
        required: [true, 'Device type is required']
    },
    deviceName: {
        type: String,
        maxlength: [100, 'Device name cannot exceed 100 characters']
    }
}, {
    timestamps: true
});

// Compound unique index: one token per user-device combination
deviceTokenSchema.index({ userId: 1, fcmToken: 1 }, { unique: true });

// Index for quick lookup by fcmToken
deviceTokenSchema.index({ fcmToken: 1 });

const DeviceToken = mongoose.model<IDeviceTokenDocument>('DeviceToken', deviceTokenSchema);

export default DeviceToken;
