import { Router } from 'express';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { purchasePackageSchema, userPackageIdParamSchema } from '../validations/userPackageValidation';
import { purchasePackage, getMyPackages, getUserPackageById, usePost } from '../controllers/userPackageController';

const router = Router();

router.post('/purchase',
    validate(purchasePackageSchema, 'body'),
    verifyToken,
    requireUser,
    purchasePackage
);
router.get('/myallpackages',
    verifyToken,
    requireUser,
    getMyPackages
);
router.get('/:id',
    validate(userPackageIdParamSchema, 'params'),
    verifyToken,
    requireUser,
    getUserPackageById
);

router.patch('/:id/use-post',
    validate(userPackageIdParamSchema, 'params'),
    verifyToken,
    requireUser,
    usePost
);
export default router;