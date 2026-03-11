import { z } from "zod";
import { isValidateObjectId } from "./customValidation";

//Create conversation
export const createConversationSchema = z.object({
    receiverId: z.string().min(1, 'ReceiverId is required')
        .refine(isValidateObjectId, 'Invalid Receiver ID format')
})
