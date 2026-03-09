import { Document, Types } from "mongoose";

export enum MessageType {
    TEXT = 'TEXT',
    PRODUCT = 'PRODUCT',
    IMAGE = 'IMAGE'
}

//Interface raw data
export interface IMessage {
    conversationId: Types.ObjectId;
    senderId: Types.ObjectId;
    content?: string;
    type: MessageType;
    bicycleId?: Types.ObjectId;
    isRead: Boolean
}

//Interface for mongoose doc
export interface IMessageDocument extends IMessage, Document {
    createdAt: Date;
    updatedAt: Date;
}

