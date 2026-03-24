import { z } from "zod";
import { MessageType } from "../types";
import { isValidateObjectId } from "./customValidation";

const isValidUrl = (value?: string): boolean => {
    if (!value) return false;
    return z.string().url().safeParse(value).success;
};

//Send message Schema
export const sendMessageSchema = z.object({
    content: z.string().optional(),
    type: z.nativeEnum(MessageType).default(MessageType.TEXT),
    bicycleId: z.string()
        .refine(isValidateObjectId, 'Invalid Bicycle ID format')
        .optional()
})
    .refine(data => {
        //System type reserved for server
        if (data.type === MessageType.SYSTEM) {
            return false;
        }
        return true;
    }, {
        message: "Loại tin nhắn SYSTEM chỉ dành cho hệ thống.",
        path: ["type"]
    })
    .refine(data => {
        //Text
        if (data.type === MessageType.TEXT && (!data.content || data.content.trim() === '')) {
            return false;
        }
        return true;
    }, {
        message: "Nội dung là bắt buộc đối với tin nhắn văn bản.",
        path: ["content"]
    })
    .refine(data => {
        //Product
        if (data.type === MessageType.PRODUCT && (!data.bicycleId)) {
            return false;
        }
        return true;
    }, {
        message: "bicycleId là bắt buộc đối với tin nhắn SẢN PHẨM.",
        path: ["bicycleId"]
    })
    .refine(data => {
        //Image
        if (data.type !== MessageType.IMAGE) {
            return true;
        }
        return isValidUrl(data.content);
    }, {
        message: "Nội dung phải là URL hợp lệ đối với tin nhắn HÌNH ẢNH.",
        path: ["content"]
    });

//Validate for cursor
export const getMessagesQuerySchema = z.object({
    cursor: z.string()
        .refine(isValidateObjectId, 'Invalid Cursor ID format')
        .optional(),
    limit: z.string()
        .regex(/^\d+$/, 'Limit must be a positive number')
        .optional()
        .transform(val => val ? parseInt(val, 10) : 20) // default: 20 message
        .pipe(z.number().min(1, 'Limit must be greater than 0').max(100, 'Limit cannot exceed 100'))
});

//  Validate ID Conversation Param
export const conversationParamsSchema = z.object({
    conversationId: z.string()
        .refine(isValidateObjectId, 'Invalid conversation Id format')
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type GetMessagesQuery = z.infer<typeof getMessagesQuerySchema>;