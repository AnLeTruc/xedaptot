import { z } from "zod";
import mongoose from "mongoose";

//Helper for validate objectId
const isValidateObjectId = (val: string) => {
    return mongoose.Types.ObjectId.isValid(val);
}

//Create conversation
export const createConversationSchema = z.object({
    body: z.object({
        receiverId: z.string().min(1, 'ReceiverID is required')
            .refine(isValidateObjectId, 'Invalid Receiver ID format')
    })
})
