import { Router } from 'express';
import {
    createConversation,
    getConversations,
    getMessageHistory,
    markAsRead,
    markAsUnread,
    getUnreadCount,
    hideConversation,
    startSupportConversation,
    deleteConversation,
    deleteAllConversations,
    getHiddenConversations
} from '../controllers/conversationController';
import { validate } from '../middleware/validate';
import { createConversationSchema } from '../validations/conversationValidation';
import { verifyToken, requireUser } from '../middleware/auth';
import messageRouter from './message';
import { searchMessages } from '../controllers/messageController';

const router = Router();

router.get('/messages/search', verifyToken, requireUser, searchMessages);
router.use('/:conversationId/messages', messageRouter);

router.post('/support/start', verifyToken, requireUser, startSupportConversation);
router.post('/', verifyToken, requireUser, validate(createConversationSchema, 'body'), createConversation);
router.get('/', verifyToken, requireUser, getConversations);
router.get('/hidden', verifyToken, requireUser, getHiddenConversations);
router.get('/unread-count', verifyToken, requireUser, getUnreadCount);
router.put('/:id/read', verifyToken, requireUser, markAsRead);
router.put('/:id/unread', verifyToken, requireUser, markAsUnread);
router.patch('/:id/hide', verifyToken, requireUser, hideConversation);
router.get('/:id', verifyToken, requireUser, getMessageHistory);
router.delete('/', verifyToken, requireUser, deleteAllConversations);
router.delete('/:id', verifyToken, requireUser, deleteConversation);



export default router;
