import { Router } from 'express';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { purchasePackageSchema } from '../validations/userPackageValidation';
import { purchasePackage } from '../controllers/userPackageController';

const router = Router();

// POST /api/user-packages/purchase
router.post('/purchase',
    validate(purchasePackageSchema, 'body'),  // Validate trước
    verifyToken,                               // Xác thực Firebase token
    requireUser,                               // Kiểm tra user đã đăng ký
    purchasePackage                            // Controller
);

export default router;