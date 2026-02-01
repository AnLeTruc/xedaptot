import { Router } from 'express';
import {
    getProfile,
    updateProfile,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress
} from '../controllers/authController';
import {
    getMyPackages,
    getMyActivePackage,
    getUserPackageById,
    purchasePackage,
    cancelUserPackage
} from '../controllers/userPackageController';
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

// Packages (RESTful nested resource)
router.get('/packages', verifyToken, requireUser, getMyPackages);
router.get('/packages/active', verifyToken, requireUser, getMyActivePackage);
router.get('/packages/:id', verifyToken, requireUser, getUserPackageById);
router.post('/packages', verifyToken, requireUser, purchasePackage);
router.patch('/packages/:id', verifyToken, requireUser, cancelUserPackage);

export default router;
