import { Document, Types } from "mongoose";

// Device Type
export type DeviceType = 'ios' | 'android' | 'web';

// DeviceToken Interface
export interface IDeviceToken {
    userId: Types.ObjectId;
    fcmToken: string;
    deviceType: DeviceType;
    deviceName?: string;
}

export interface IDeviceTokenDocument extends IDeviceToken, Document {
    createdAt: Date;
    updatedAt: Date;
}
