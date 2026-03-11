import { Document, Types } from "mongoose";

export type LockedStatus = 'NONE' | 'TEMP_LOCKED' | 'PERM_LOCKED';

//Interface raw data
export interface IConversation {
    participants: Types.ObjectId[];
    lastMessage?: Types.ObjectId;
    readStatus: Map<string, Date>;
    hiddenBy?: Types.ObjectId[];
    violationCount: number;
    lockedStatus: LockedStatus;
    lockedUntil?: Date | null;
    lockedReason?: string | null;
}

//Interface mongoose doc
export interface IConversationDocument extends IConversation, Document {
    createdAt: Date;
    updatedAt: Date;
}

