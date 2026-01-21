import { Router } from 'express';
import { firebaseAuth, getProfile, updateProfile, emailRegister, emailLogin } from '../controllers/authController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

// Firebase auth 
router.post('/firebase', firebaseAuth);

router.post('/email/register', emailRegister);
router.post('/email/login', emailLogin);

router.get('/profile', verifyToken, requireUser, getProfile);
router.put('/profile', verifyToken, requireUser, updateProfile);

export default router;