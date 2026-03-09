import { z } from "zod";
import mongoose from "mongoose";
import { isValidateObjectId } from "./customValidation";

//Create conversation
export const createConversationSchema = z.object({
    body: z.object({
        receiverId: z.string().min(1, 'ReceiverID is required')
            .refine(isValidateObjectId, 'Invalid Receiver ID format')
    })
})
