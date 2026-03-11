import mongoose, { Schema } from 'mongoose';
import { IRestrictedWordDocument } from '../types';

const restrictedWordSchema = new Schema<IRestrictedWordDocument>({
    word: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

restrictedWordSchema.index({ word: 1 }, { unique: true });

const RestrictedWord = mongoose.model<IRestrictedWordDocument>('RestrictedWord', restrictedWordSchema);
export default RestrictedWord;
