import mongoose, { Schema } from 'mongoose';
import { IDisputeDocument } from '../types';



const disputeUserSchema = new Schema({
    _id: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fullName: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
}, { _id: false });



const disputeSchema = new Schema<IDisputeDocument>({
    disputeType: {
        type: String,
        enum: ['ITEM_NOT_AS_DESCRIBED', 'ITEM_NOT_RECEIVED', 'DAMAGED_ITEM', 'FAKE_ITEM', 'OTHER'],
        required: true,
    },
    status: {
        type: String,
        enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED'],
        default: 'PENDING'
    },
    resolution: {
        type: String,
        enum: ['REFUND_BUYER', 'RELEASE_SELLER', 'NONE'],
        default: 'NONE'
    },
    createdAt?: Date,
    resolvedAt?: Date,
    complainant: disputeUserSchema,
    respondent: disputeUserSchema,
    orderId: {
        type: Schema.Types.ObjectId,
        ref: 'Order',
        required: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    reason: {
        type: String,
        required: true
    },
    evidenceImage: [{ type: String }]
}, { timestamps: true });


export default mongoose.model<IDisputeDocument>('Dispute', disputeSchema);