import mongoose, { Schema } from 'mongoose';
import { IInspectionReportDocument } from '../types/inspectionReport';

const inspectionConditionsSchema = new Schema({
    frame: {
        type: String,
        enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
        required: [true, 'Frame condition is required']
    },
    brake: {
        type: String,
        enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
        required: [true, 'Brake condition is required']
    },
    drivetrain: {
        type: String,
        enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
        required: [true, 'Drivetrain condition is required']
    },
    wheels: {
        type: String,
        enum: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
        required: [true, 'Wheels condition is required']
    },
    notes: {
        type: String,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
}, { _id: false });

const inspectionReportSchema = new Schema<IInspectionReportDocument>({
    bicycleId: {
        type: Schema.Types.ObjectId,
        ref: 'Bicycle',
        required: [true, 'Bicycle ID is required'],
        index: true
    },
    inspectorId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Inspector ID is required'],
        index: true
    },
    assignedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    status: {
        type: String,
        enum: ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'],
        default: 'PENDING',
        index: true
    },
    conditions: {
        type: inspectionConditionsSchema,
        required: function (this: IInspectionReportDocument) {
            return this.status === 'COMPLETED' || this.status === 'REJECTED';
        }
    },
    overallRating: {
        type: Number,
        min: [1, 'Rating must be at least 1'],
        max: [5, 'Rating cannot exceed 5']
    },
    isPassed: {
        type: Boolean,
        default: false
    },
    images: [{
        type: String
    }],
    notes: {
        type: String,
        maxlength: [2000, 'Notes cannot exceed 2000 characters']
    },
    scheduledAt: {
        type: Date
    },
    completedAt: {
        type: Date
    },
    submittedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Compound index for unique bicycle-inspector combination
inspectionReportSchema.index({ bicycleId: 1, inspectorId: 1 });

// Note: completedAt and submittedAt will be set in controller when status changes

const InspectionReport = mongoose.model<IInspectionReportDocument>('InspectionReport', inspectionReportSchema);

export default InspectionReport;
