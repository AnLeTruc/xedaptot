import mongoose, { Schema, Document } from 'mongoose';
import { IViolationReportDocument } from '../types/violationReport';

const violationReportSchema = new Schema<IViolationReportDocument>({
    reporter: {
        _id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        fullName: { type: String, required: true },
        email: { type: String },
    },
    reportedUser: {
        _id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        fullName: { type: String, required: true },
        email: { type: String },
    },
    targetBicycle: {
        _id: { type: Schema.Types.ObjectId, ref: 'Bicycle', required: true },
        title: { type: String, required: true },
        price: { type: Number, required: true },
        image: { type: String },
        sellerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    },
    violationType: {
        type: String,
        enum: ['FRAUD', 'FAKE_LISTING', 'INAPPROPRIATE', 'STOLEN_BICYCLE', 'DUPLICATE_LISTING', 'OTHER'],
        required: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'REVIEWING', 'RESOLVE', 'REJECTED'],
        default: 'PENDING',
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    adminNotes: {
        type: String,
        trim: true,
        maxlength: [2000, 'Admin notes cannot exceed 2000 characters'],
    },
}, {
    timestamps: true,
})


violationReportSchema.index({ 'reporter._id': 1, status: 1 });
violationReportSchema.index({ 'reportedUser._id': 1, status: 1 });
violationReportSchema.index({ status: 1 });


const ViolationReport = mongoose.model<IViolationReportDocument>(
    'ViolationReport',
    violationReportSchema
);
export default ViolationReport;