import { z } from "zod";
import { MessageType } from "../types";
import { isValidateObjectId } from "./customValidation";

//Send message Schema
export const sendMessageSchema = z.object({
    body: z.object({
        content: z.string().optional(),
        type: z.nativeEnum(MessageType).default(MessageType.TEXT),
        bicycleId: z.string()
            .refine(isValidateObjectId, 'Invalid Bicycle ID format')
            .optional()
    })
        .refine(data => {
            //Text
            if (data.type === MessageType.TEXT && (!data.content || data.content.trim() === '')) {
                return false;
            }
            return true;
        }, {
            message: "Content is required for Text message.",
            path: ["content"]
        })
        .refine(data => {
            //Product
            if (data.type === MessageType.PRODUCT && (!data.bicycleId)) {
                return false;
            }
            return true;
        }, {
            message: "bicycleId is required for PRODUCT messages.",
            path: ["bicycleId"]
        })
        .refine(data => {
            //Image
            if (data.type === MessageType.IMAGE && (!data.content || data.content.trim() === '')) {
                return false;
            }
            return true;
        }, {
            message: "Content (image URL) is required for IMAGE messages.",
            path: ["content"]
        })
});

//Validate for cursor
export const getMessagesQuerySchema = z.object({
    query: z.object({
        cursor: z.string()
            .refine(isValidateObjectId, 'Invalid Cursor ID format')
            .optional(),
        limit: z.string()
            .regex(/^\d+$/, 'Limit must be a positive number')
            .optional()
            .transform(val => val ? parseInt(val, 10) : 20) // default: 20 message
            .pipe(z.number().min(1, 'Limit must be greater than 0').max(100, 'Limit cannot exceed 100'))
    })
});

//  Validate ID Conversation Param
export const conversationParamsSchema = z.object({
    params: z.object({
        conversationId: z.string()
            .refine(isValidateObjectId, 'Invalid conversation Id format')
    })
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>['body'];
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>['query'];