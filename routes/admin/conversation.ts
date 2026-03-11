import { Router } from 'express';
import {
	getAllConversationsAdmin,
	getConversationMessagesAdmin,
	lockConversation,
	unlockConversation
} from '../../controllers/admin/conversationController';
import { verifyToken } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/rbac';

const router = Router();

router.use(verifyToken, requireAdmin);

router.get('/conversations', getAllConversationsAdmin);
router.get('/conversations/:id/messages', getConversationMessagesAdmin);
router.put('/conversations/:id/lock', lockConversation);
router.put('/conversations/:id/unlock', unlockConversation);

export default router;
