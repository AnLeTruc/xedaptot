// routes/package.ts
import { Router } from 'express';
import {
    getAllPackages,
    getPackageById,
    createPackage,
    updatePackage
} from '../controllers/packageController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

// Public routes
router.get('/', getAllPackages);
router.get('/:id', getPackageById);

//Admin
router.post('/:id', verifyToken, requireUser, createPackage);
router.put('/:id', verifyToken, requireUser, updatePackage);



export default router;