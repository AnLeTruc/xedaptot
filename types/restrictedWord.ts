import { Document } from "mongoose";

export interface IRestrictedWord {
    word: string;
    isActive: boolean;
}

export interface IRestrictedWordDocument extends IRestrictedWord, Document {
    createdAt: Date;
    updatedAt: Date;
}
