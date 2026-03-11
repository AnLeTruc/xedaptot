import mongoose, { Schema } from "mongoose";
import { IMessageDocument, MessageType } from "../types";

const messageSchema = new Schema<IMessageDocument>({
    conversationId: {
        type: Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true
    },
    senderId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: Object.values(MessageType),
        default: MessageType.TEXT,
        required: true
    },
    bicycleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bicycle'
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

//Index
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ conversationId: 1, _id: -1 });

const Message = mongoose.model<IMessageDocument>('Message', messageSchema);
export default Message;