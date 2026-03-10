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
            message: 'A conversation must have exactly two participants.'
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
        default: new Map()
    },
    hiddenBy: {
        type: [{
            type: Schema.Types.ObjectId,
            ref: 'User'
        }],
        default: []
    }
}, { timestamps: true });

//Index
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model<IConversationDocument>('Conversation', conversationSchema);
export default Conversation;

