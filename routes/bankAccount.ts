import { Router } from 'express';
import * as ctrl from '../controllers/bankAccountController';
import { verifyToken, requireUser, requireVerifiedUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { addBankAccountSchema, updateBankAccountSchema } from '../validations/bankAccountValidation';

const router = Router();

// All routes require authentication + verified email
router.use(verifyToken, requireUser, requireVerifiedUser);

// GET /api/bank-accounts - Get all my bank accounts
router.get('/', ctrl.getBankAccounts);

// GET /api/bank-accounts/:id - Get a single bank account
router.get('/:id', ctrl.getBankAccountById);

// POST /api/bank-accounts - Add a bank account
router.post('/', validate(addBankAccountSchema, 'body'), ctrl.addBankAccount);

// PUT /api/bank-accounts/:id - Update a bank account
router.put('/:id', validate(updateBankAccountSchema, 'body'), ctrl.updateBankAccount);

// DELETE /api/bank-accounts/:id - Soft delete a bank account
router.delete('/:id', ctrl.deleteBankAccount);

// PUT /api/bank-accounts/:id/default - Set as default
router.put('/:id/default', ctrl.setDefaultBankAccount);


export default router;
