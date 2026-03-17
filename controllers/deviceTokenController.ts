import { Response } from 'express';
import { AuthRequest } from '../types';
import DeviceToken from '../models/DeviceToken';
import { sendToUser } from '../services/pushNotificationService';

/**
 * POST /api/device-tokens/register
 * Register or update an FCM token for the authenticated user
 */
export const registerToken = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { fcmToken, deviceType, deviceName } = req.body;

        // Upsert: if this token already exists for this user, update it; otherwise create
        const deviceToken = await DeviceToken.findOneAndUpdate(
            { userId, fcmToken },
            {
                userId,
                fcmToken,
                deviceType,
                deviceName,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(201).json({
            success: true,
            message: 'FCM Token registered successfully',
            data: {
                id: deviceToken._id,
                fcmToken: deviceToken.fcmToken,
                deviceType: deviceToken.deviceType,
                deviceName: deviceToken.deviceName,
            }
        });
    } catch (error: any) {
        console.error('Error registering FCM token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to register FCM token',
        });
    }
};

/**
 * POST /api/device-tokens/send
 * Send a push notification to a specific user
 */
export const sendNotification = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { userId, title, body, data } = req.body;

        const result = await sendToUser(userId, { title, body, data });

        if (result.successCount === 0 && result.failureCount === 0) {
            res.status(404).json({
                success: false,
                message: 'No device tokens found for this user',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Notification sent successfully',
            data: {
                successCount: result.successCount,
                failureCount: result.failureCount,
            }
        });
    } catch (error: any) {
        console.error('Error sending notification:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send notification',
        });
    }
};

/**
 * DELETE /api/device-tokens
 * Remove an FCM token (e.g., on logout or disabling notifications)
 */
export const removeToken = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { fcmToken } = req.body;

        const result = await DeviceToken.findOneAndDelete({ userId, fcmToken });

        if (!result) {
            res.status(404).json({
                success: false,
                message: 'FCM Token not found',
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'FCM Token removed successfully',
        });
    } catch (error: any) {
        console.error('Error removing FCM token:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to remove FCM token',
        });
    }
};
