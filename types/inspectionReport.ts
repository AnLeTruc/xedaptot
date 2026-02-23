import { Document, Types } from "mongoose";
import { InspectionStatus } from "./bicycle";

export { InspectionStatus };

// Condition Rating
export type ConditionRating = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

// Inspection Conditions
export interface IInspectionConditions {
    frame: ConditionRating;
    brake: ConditionRating;
    drivetrain: ConditionRating;
    wheels: ConditionRating;
    notes?: string;
}

// Inspection Report Interface
export interface IInspectionReport {
    bicycleId: Types.ObjectId;
    inspectorId: Types.ObjectId;
    assignedBy?: Types.ObjectId;        // Admin who assigned (if any)
    status: InspectionStatus;
    conditions: IInspectionConditions;
    overallRating: number;              // 1-5
    isPassed: boolean;
    images?: string[];
    notes?: string;
    scheduledAt?: Date;
    completedAt?: Date;
    submittedAt?: Date;
}

export interface IInspectionReportDocument extends IInspectionReport, Document {
    createdAt: Date;
    updatedAt: Date;
}
