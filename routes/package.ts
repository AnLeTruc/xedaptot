// routes/package.ts
import { Router } from 'express';
import {
    getAllPackages,
    getPackageById,
    createPackage,
    updatePackage,
    deletePackage,
    togglePackageActive
} from '../controllers/packageController';
import { verifyToken, requireUser } from '../middleware/auth';
import {
    createPackageSchema,
    updatePackageSchema,
    getPackagesQuerySchema,
    packageIdParamSchema
} from '../validations/packageValidation';
import { validate } from '../middleware/validate';

const router = Router();

// Public routes
// Public routes
router.get('/', validate(getPackagesQuerySchema, 'query'), getAllPackages);
router.get('/:id', validate(packageIdParamSchema, 'params'), getPackageById);

//Admin
router.post('/', validate(createPackageSchema, 'body'), verifyToken, requireUser, createPackage);
router.put('/:id',
    validate(packageIdParamSchema, 'params'),
    validate(updatePackageSchema, 'body'),
    verifyToken, requireUser, updatePackage
);
router.delete('/:id', validate(packageIdParamSchema, 'params'), verifyToken, requireUser, deletePackage);
router.patch('/:id/toggle-active', validate(packageIdParamSchema, 'params'), verifyToken, requireUser, togglePackageActive);
export default router;


