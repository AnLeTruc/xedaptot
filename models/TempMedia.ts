import mongoose, { Schema, Document } from 'mongoose';

export interface ITempMedia extends Document {
    public_id: string;
    url: string;
    createdAt: Date;
}

const tempMediaSchema = new Schema<ITempMedia>(
    {
        public_id: {
            type: String,
            required: true,
            unique: true,
        },
        url: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            // expires: 86400
        },
    },
    {
        timestamps: false,
    }
);

const TempMedia = mongoose.model<ITempMedia>('TempMedia', tempMediaSchema);

export default TempMedia;
