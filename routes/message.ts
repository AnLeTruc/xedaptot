import { Router } from 'express';
import { sendMessage } from '../controllers/messageController';
import { validate } from '../middleware/validate';
import { verifyToken, requireUser } from '../middleware/auth';
import { sendMessageSchema, conversationParamsSchema } from '../validations/messageValidation';

const router = Router({ mergeParams: true });

router.post(
    '/',
    verifyToken,
    requireUser,
    validate(conversationParamsSchema, 'params'),
    validate(sendMessageSchema, 'body'),
    sendMessage
);

export default router;
