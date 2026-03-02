import { Router } from 'express';
import * as ctrl from '../controllers/walletController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { withdrawSchema, depositSchema } from '../validations/walletValidation';

const router = Router();

// VNPay callbacks - NO AUTH required (VNPay redirects/calls directly)
router.get('/vnpay-return', ctrl.vnpayReturn);
router.get('/vnpay-ipn', ctrl.vnpayIPN);

// All routes below require authentication
router.use(verifyToken, requireUser);

// GET /api/wallets/me - Get my wallet info
router.get('/me', ctrl.getMyWallet);

// GET /api/wallets/transactions - Get transaction history
router.get('/transactions', ctrl.getTransactions);

// POST /api/wallets/deposit - Deposit via VNPay
router.post('/deposit', validate(depositSchema, 'body'), ctrl.depositToWallet);

// POST /api/wallets/withdraw - Create withdraw request
router.post('/withdraw', validate(withdrawSchema, 'body'), ctrl.createWithdrawRequest);

// GET /api/wallets/withdraw-requests - Get my withdraw requests
router.get('/withdraw-requests', ctrl.getWithdrawRequests);

export default router;
