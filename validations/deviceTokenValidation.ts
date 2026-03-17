import { z } from 'zod';

// POST /api/device-tokens/register
export const registerTokenSchema = z.object({
    fcmToken: z.string().min(1, 'FCM Token is required'),
    deviceType: z.enum(['ios', 'android', 'web']),
    deviceName: z.string().max(100, 'Device name cannot exceed 100 characters').optional()
});

// POST /api/device-tokens/send
export const sendNotificationSchema = z.object({
    userId: z.string().min(1, 'User ID is required'),
    title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
    body: z.string().min(1, 'Body is required').max(1000, 'Body cannot exceed 1000 characters'),
    data: z.record(z.string(), z.string()).optional()
});

// DELETE /api/device-tokens
export const removeTokenSchema = z.object({
    fcmToken: z.string().min(1, 'FCM Token is required')
});

