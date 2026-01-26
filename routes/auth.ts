import { Router } from 'express';
import { firebaseAuth, getProfile, updateProfile, addAddress, updateAddress } from '../controllers/authController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.post('/firebase', firebaseAuth);

router.get('/profile', verifyToken, requireUser, getProfile);
router.put('/profile', verifyToken, requireUser, updateProfile);

router.post('/addresses', verifyToken, requireUser, addAddress);
router.put('/addresses/:id', verifyToken, requireUser, updateAddress);
// router.delete('/addresses/:id', verifyToken, requireUser, deleteAddress);
// router.put('/addresses/:id/default', verifyToken, requireUser, setDefaultAddress);
export default router;