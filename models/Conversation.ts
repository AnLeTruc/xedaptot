import mongoose, { Schema } from 'mongoose';
import { IConversationDocument } from '../types/conversation';

const conversationSchema = new Schema<IConversationDocument>({
    participants: {
        type: [{
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }],
        //Validate 2 people 1 chat
        validate: {
            validator: function (v: mongoose.Types.ObjectId[]) {
                return v.length === 2;
            },
            message: 'Một cuộc hội thoại phải có chính xác hai người tham gia.'
        }
    },
    //Last mess for quick querry
    lastMessage: {
        type: Schema.Types.ObjectId,
        ref: 'Message',
        default: null
    },
    readStatus: {
        type: Map,
        of: Date,
        default: () => new Map()
    },
    hiddenBy: {
        type: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    },
    violationCount: {
        type: Number,
        default: 0
    },
    lockedStatus: {
        type: String,
        enum: ['NONE', 'TEMP_LOCKED', 'PERM_LOCKED'],
        default: 'NONE'
    },
    lockedUntil: {
        type: Date,
        default: null
    },
    lockedReason: {
        type: String,
        default: null,
        trim: true
    }
}, { timestamps: true });

//Index
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });
conversationSchema.index({ lockedStatus: 1 });

const Conversation = mongoose.model<IConversationDocument>('Conversation', conversationSchema);
export default Conversation;

