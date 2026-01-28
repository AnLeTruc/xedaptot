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

const router = Router();

// Public routes
router.get('/', getAllPackages);
router.get('/:id', getPackageById);

//Admin
router.post('/', verifyToken, requireUser, createPackage);
router.put('/:id', verifyToken, requireUser, updatePackage);
router.delete('/:id', verifyToken, requireUser, deletePackage);
router.patch('/:id/toggle-active', verifyToken, requireUser, togglePackageActive);
export default router;


