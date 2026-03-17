import { Router } from 'express';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    getNotifications,
    markAsRead,
    markAllAsRead
} from '../controllers/notificationController';
import {
    getNotificationsSchema,
    notificationIdSchema
} from '../validations/notificationValidation';

const router = Router();

router.use(verifyToken, requireUser);

router.get('/', validate(getNotificationsSchema, 'query'), getNotifications);
router.post('/read-all', markAllAsRead);
router.post('/:id/read', validate(notificationIdSchema, 'params'), markAsRead);

export default router;