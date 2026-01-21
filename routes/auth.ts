import { Router } from 'express';
import { firebaseAuth, getProfile, updateProfile } from '../controllers/authController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.post('/firebase', firebaseAuth);

// Profile routes - yêu cầu đăng nhập
router.get('/profile', verifyToken, requireUser, getProfile);
router.put('/profile', verifyToken, requireUser, updateProfile);

export default router;