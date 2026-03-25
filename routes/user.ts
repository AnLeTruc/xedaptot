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
    cancelUserPackage,
    packageVnpayReturn,
} from '../controllers/userPackageController';
import { getMyInspectionRequests } from '../controllers/bicycleController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addAddressSchema, updateAddressSchema } from '../validations/addressValidation';
import { getSellerReviews } from '../controllers/orderController';

const router = Router();

// VNPay callback — no auth (VNPay redirects here after payment)
router.get('/packages/vnpay-return', packageVnpayReturn);

// Public reviews
router.get('/:id/reviews', getSellerReviews);

// Profile
router.get('/profile', verifyToken, requireUser, getProfile);
router.put('/profile', verifyToken, requireUser, updateProfile);

// Address
router.post('/addresses', verifyToken, requireUser, validate(addAddressSchema, 'body'), addAddress);
router.put('/addresses/:id', verifyToken, requireUser, validate(updateAddressSchema, 'body'), updateAddress);
router.delete('/addresses/:id', verifyToken, requireUser, deleteAddress);
router.put('/addresses/:id/default', verifyToken, requireUser, setDefaultAddress);

// Inspection Requests
router.get('/inspection-requests', verifyToken, requireUser, getMyInspectionRequests);

// Packages (RESTful nested resource)
router.get('/packages', verifyToken, requireUser, getMyPackages);
router.get('/packages/active', verifyToken, requireUser, getMyActivePackage);
router.get('/packages/:id', verifyToken, requireUser, getUserPackageById);
router.post('/packages', verifyToken, requireUser, purchasePackage);
router.patch('/packages/:id', verifyToken, requireUser, cancelUserPackage);

export default router;
