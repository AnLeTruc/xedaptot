import { Document, Types } from "mongoose";

//Interface raw data
export interface IConversation {
    participants: Types.ObjectId[];
    lastMessage?: Types.ObjectId;
    readStatus: Map<string, Date>;
}

//Interface mongoose doc
export interface IConversationDocument extends IConversation, Document {
    createdAt: Date;
    updatedAt: Date;
}

