import { Router } from 'express';
import { sendMessage, connectAdmin } from '../controllers/chatbotController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.post('/message', verifyToken, requireUser, sendMessage);
router.post('/connect-admin', verifyToken, requireUser, connectAdmin);

export default router;
