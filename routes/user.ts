import { Router } from 'express';
import {
    getProfile,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} from '../controllers/authController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

// Profile
router.get('/profile', verifyToken, requireUser, getProfile);
router.put('/profile', verifyToken, requireUser, updateProfile);

// Address
router.post('/addresses', verifyToken, requireUser, addAddress);
router.put('/addresses/:id', verifyToken, requireUser, updateAddress);
router.delete('/addresses/:id', verifyToken, requireUser, deleteAddress);
router.put('/addresses/:id/default', verifyToken, requireUser, setDefaultAddress);

export default router;
