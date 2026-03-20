import { z } from 'zod';

const NOTIFICATION_TYPES = [
    'ACCOUNT',
    'PROFILE',
    'LISTING',
    'ORDER',
    'WALLET',
    'CHAT',
    'SUBSCRIPTION'
] as const;

//Get noti
export const getNotificationsSchema = z.object({
    page: z
        .string()
        .optional()
        .default('1')
        .transform(val => parseInt(val, 10))
        .pipe(z.number().int().min(1, 'Trang phải từ 1 trở lên')),

    limit: z
        .string()
        .optional()
        .default('20')
        .transform(val => parseInt(val, 10))
        .pipe(z.number().int().min(1).max(100, 'Limit không được vượt quá 100')),

    type: z
        .enum(NOTIFICATION_TYPES, {
            message: `Loại phải là một trong: ${NOTIFICATION_TYPES.join(', ')}`
        })
        .optional(),

    isRead: z
        .enum(['true', 'false'], {
            message: 'isRead phải là "true" hoặc "false"'
        })
        .optional()
        .transform(val => (val === undefined ? undefined : val === 'true'))
});

//Read noti
export const notificationIdSchema = z.object({
    id: z
        .string({ message: 'Mã thông báo là bắt buộc' })
        .min(1, 'Mã thông báo không được để trống')
        .regex(/^[a-f\d]{24}$/i, 'Định dạng mã thông báo không hợp lệ')
});

// Infer types
export type GetNotificationsQuery = z.infer<typeof getNotificationsSchema>;
export type NotificationIdParams = z.infer<typeof notificationIdSchema>;
