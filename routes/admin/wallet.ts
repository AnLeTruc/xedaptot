import { Router } from 'express';
import {
    approveWithdrawRequest,
    getWithdrawRequestsAdmin,
    rejectWithdrawRequest
} from '../../controllers/admin/walletController';
import { verifyToken, requireAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
    approveWithdrawRequestSchema,
    adminWithdrawRequestIdParamSchema,
    adminWithdrawRequestsQuerySchema,
    rejectWithdrawRequestSchema
} from '../../validations/adminWalletValidation';

const router = Router();

router.use(verifyToken, requireAdmin);

router.get('/withdraw-requests', validate(adminWithdrawRequestsQuerySchema, 'query'), getWithdrawRequestsAdmin);
router.put('/withdraw-requests/:id/approve', validate(adminWithdrawRequestIdParamSchema, 'params'), validate(approveWithdrawRequestSchema, 'body'), approveWithdrawRequest);
router.put('/withdraw-requests/:id/reject', validate(adminWithdrawRequestIdParamSchema, 'params'), validate(rejectWithdrawRequestSchema, 'body'), rejectWithdrawRequest);

export default router;
