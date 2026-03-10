import { Router } from 'express';
import { createConversation, getConversations, getMessageHistory, markAsRead } from '../controllers/conversationController';
import { validate } from '../middleware/validate';
import { createConversationSchema } from '../validations/conversationValidation';
import { verifyToken, requireUser } from '../middleware/auth';
import messageRouter from './message';

const router = Router();

router.use('/:conversationId/messages', messageRouter);

router.post('/', verifyToken, requireUser, validate(createConversationSchema, 'body'), createConversation);
router.get('/', verifyToken, requireUser, getConversations);
router.put('/:id/read', verifyToken, requireUser, markAsRead);
router.get('/:id', verifyToken, requireUser, getMessageHistory);


export default router;
