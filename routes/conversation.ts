import { Router } from 'express';
import { createConversation } from '../controllers/conversationController';
import { validate } from '../middleware/validate';
import { createConversationSchema } from '../validations/conversationValidation';
import { verifyToken, requireUser } from '../middleware/auth';
import messageRouter from './message';

const router = Router();

router.use('/:conversationId/messages', messageRouter);

router.post('/', verifyToken, requireUser, validate(createConversationSchema, 'body'), createConversation);

export default router;
