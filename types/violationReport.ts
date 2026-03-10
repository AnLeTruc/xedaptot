import { Document, Types } from 'mongoose';


export interface IViolationReporter {
    _id: Types.ObjectId;
    fullName: string;
    email: string;
}



export interface IViolationReportedUser {
    _id: Types.ObjectId;
    fullName: string;
    email: string;
}



export interface IViolationTargetBicycle {
    _id: Types.ObjectId;
    title: string;
    price: number;
    image?: string;
    sellerId: Types.ObjectId
}



export type ViolationType =
    | 'FRAUD'              // lừa đảo
    | 'FAKE_LISTING'       // tin đăng giả
    | 'INAPPROPRIATE'      // nội dung không phù hợp
    | 'STOLEN_BICYCLE'     // xe bị đánh cắp
    | 'DUPLICATE_LISTING'  // tin trùng lặp
    | 'OTHER'              // khác



export type ViolationStatus =
    | 'PENDING'            // Chờ xử lý
    | 'REVIEWING'          // đang xem xét
    | 'RESOLVE'            // đã xử lý
    | 'REJECTED';          // bác bỏ




export interface IViolationReport {
    reporter: IViolationReporter;
    reportedUser: IViolationReportedUser;
    targetBicycle: IViolationTargetBicycle;
    violationType: ViolationType;
    status: ViolationStatus;
    description: string;
    adminNotes?: string;
}



export interface IViolationReportDocument extends IViolationReport, Document {
    createdAt: Date;
    updatedAt: Date;
}