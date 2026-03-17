import DeviceToken from '../models/DeviceToken';

const { messaging } = require('../config/firebase');

interface NotificationPayload {
    title: string;
    body: string;
    data?: Record<string, string>;
}

/**
 * Send push notification to a single user (all their registered devices)
 */
export const sendToUser = async (userId: string, payload: NotificationPayload): Promise<{
    successCount: number;
    failureCount: number;
}> => {
    // Get all FCM tokens for this user
    const deviceTokens = await DeviceToken.find({ userId });

    if (deviceTokens.length === 0) {
        console.log(`[FCM] No device tokens found for user: ${userId}`);
        return { successCount: 0, failureCount: 0 };
    }

    const tokens = deviceTokens.map(dt => dt.fcmToken);

    const message = {
        notification: {
            title: payload.title,
            body: payload.body,
        },
        data: payload.data || {},
        tokens: tokens,
    };

    try {
        const response = await messaging.sendEachForMulticast(message);

        // Clean up invalid/expired tokens
        if (response.failureCount > 0) {
            const tokensToRemove: string[] = [];

            response.responses.forEach((resp: any, index: number) => {
                if (!resp.success) {
                    const errorCode = resp.error?.code;
                    // Remove tokens that are no longer valid
                    if (
                        errorCode === 'messaging/registration-token-not-registered' ||
                        errorCode === 'messaging/invalid-registration-token'
                    ) {
                        tokensToRemove.push(tokens[index]);
                    }
                }
            });

            if (tokensToRemove.length > 0) {
                await DeviceToken.deleteMany({ fcmToken: { $in: tokensToRemove } });
                console.log(`[FCM] Removed ${tokensToRemove.length} invalid token(s) for user: ${userId}`);
            }
        }

        console.log(`[FCM] Sent to user ${userId}: ${response.successCount} success, ${response.failureCount} failure`);

        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
        };
    } catch (error) {
        console.error(`[FCM] Error sending to user ${userId}:`, error);
        throw error;
    }
};

/**
 * Send push notification to multiple users
 */
export const sendToMultipleUsers = async (userIds: string[], payload: NotificationPayload): Promise<{
    totalSuccess: number;
    totalFailure: number;
}> => {
    let totalSuccess = 0;
    let totalFailure = 0;

    const results = await Promise.allSettled(
        userIds.map(userId => sendToUser(userId, payload))
    );

    results.forEach((result) => {
        if (result.status === 'fulfilled') {
            totalSuccess += result.value.successCount;
            totalFailure += result.value.failureCount;
        } else {
            totalFailure += 1;
        }
    });

    return { totalSuccess, totalFailure };
};
