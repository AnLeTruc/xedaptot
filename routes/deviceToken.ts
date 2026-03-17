import { Router } from 'express';
import { registerToken, sendNotification, removeToken } from '../controllers/deviceTokenController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { registerTokenSchema, sendNotificationSchema, removeTokenSchema } from '../validations/deviceTokenValidation';

const router = Router();

// Register FCM token
router.post(
    '/register',
    verifyToken,
    requireUser,
    validate(registerTokenSchema),
    registerToken
);

// Send push notification to a user
router.post(
    '/send',
    verifyToken,
    requireUser,
    validate(sendNotificationSchema),
    sendNotification
);

// Remove FCM token
router.delete(
    '/',
    verifyToken,
    requireUser,
    validate(removeTokenSchema),
    removeToken
);

export default router;
