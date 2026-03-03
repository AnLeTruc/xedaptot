import { Router } from 'express';
import {
    firebaseAuth,
    emailRegister,
    emailLogin,
    refreshToken,
    sendEmailVerification,
    verifyEmail,
    forgotPassword,
    verifyResetCode,
    resetPassword,
    changePassword
} from '../controllers/authController';
import { verifyToken, requireUser } from '../middleware/auth';
import { changePasswordLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { changePasswordSchema } from '../validations/changePasswordValidation';

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

// Change password (authenticated)
router.post('/change-password',
    changePasswordLimiter,
    verifyToken,
    requireUser,
    validate(changePasswordSchema),
    changePassword
);

export default router;