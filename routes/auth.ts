import { Router } from 'express';
import { firebaseAuth } from '../controllers/authController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.post('/firebase', firebaseAuth);

export default router;