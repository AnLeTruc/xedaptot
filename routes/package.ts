// routes/package.ts
import { Router } from 'express';
import {
    getAllPackages,
    getPackageById
} from '../controllers/packageController';

const router = Router();

// Public routes
router.get('/', getAllPackages);
router.get('/:id', getPackageById);



export default router;