import { Router } from 'express';
import {
	getAllConversationsAdmin,
	getConversationMessagesAdmin,
	lockConversation,
	unlockConversation
} from '../../controllers/admin/conversationController';
import { verifyToken, requireUser } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';

const router = Router();

router.get('/conversations', verifyToken, requireUser, requireAdmin, getAllConversationsAdmin);
router.get('/conversations/:id/messages', verifyToken, requireUser, requireAdmin, getConversationMessagesAdmin);
router.put('/conversations/:id/lock', verifyToken, requireUser, requireAdmin, lockConversation);
router.put('/conversations/:id/unlock', verifyToken, requireUser, requireAdmin, unlockConversation);

export default router;
