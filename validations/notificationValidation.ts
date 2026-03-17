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
        .pipe(z.number().int().min(1, 'Page must be at least 1')),

    limit: z
        .string()
        .optional()
        .default('20')
        .transform(val => parseInt(val, 10))
        .pipe(z.number().int().min(1).max(100, 'Limit cannot exceed 100')),

    type: z
        .enum(NOTIFICATION_TYPES, {
            message: `Type must be one of: ${NOTIFICATION_TYPES.join(', ')}`
        })
        .optional(),

    isRead: z
        .enum(['true', 'false'], {
            message: 'isRead must be "true" or "false"'
        })
        .optional()
        .transform(val => (val === undefined ? undefined : val === 'true'))
});

//Read noti
export const notificationIdSchema = z.object({
    id: z
        .string({ message: 'Notification ID is required' })
        .min(1, 'Notification ID cannot be empty')
        .regex(/^[a-f\d]{24}$/i, 'Invalid notification ID format')
});

// Infer types
export type GetNotificationsQuery = z.infer<typeof getNotificationsSchema>;
export type NotificationIdParams = z.infer<typeof notificationIdSchema>;
