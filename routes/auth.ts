import { Router } from 'express';
import { firebaseAuth } from '../controllers/authController.js';
import { verifyToken, requireUser } from '../middleware/auth.js';

const router = Router();

router.post('/firebase', firebaseAuth);

export default router;