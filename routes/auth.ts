import { Router } from 'express';
import { 
    firebaseAuth, 
    getProfile, 
    updateProfile, 
    addAddress, 
    updateAddress, 
    deleteAddress, 
    setDefaultAddress,
    emailRegister,
    emailLogin,
    refreshToken,
    sendEmailVerification,
    verifyEmail,
    forgotPassword,
    verifyResetCode,
    resetPassword
    } from '../controllers/authController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

// Firebase auth 
router.post('/firebase', firebaseAuth);
router.post('/email/register', emailRegister);
router.post('/email/login', emailLogin);
router.post('/refresh-token', refreshToken);

//Mail verify
router.post('/send-verification-email', verifyToken, requireUser, sendEmailVerification);
router.get('/verify-email', verifyEmail);

//Reset - change password
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

//Profile
router.get('/profile', verifyToken, requireUser, getProfile);
router.put('/profile', verifyToken, requireUser, updateProfile);

//Address
router.post('/addresses', verifyToken, requireUser, addAddress);
router.put('/addresses/:id', verifyToken, requireUser, updateAddress);
router.delete('/addresses/:id', verifyToken, requireUser, deleteAddress);
router.put('/addresses/:id/default', verifyToken, requireUser, setDefaultAddress);
export default router;