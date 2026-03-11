import { Router } from 'express';
import { getAllConversationsAdmin, getConversationMessagesAdmin } from '../../controllers/admin/conversationController';
import { verifyToken, requireUser } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';

const router = Router();

router.get('/conversations', verifyToken, requireUser, requireAdmin, getAllConversationsAdmin);
router.get('/conversations/:id/messages', verifyToken, requireUser, requireAdmin, getConversationMessagesAdmin);

export default router;
