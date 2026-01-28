// routes/package.ts
import { Router } from 'express';
import {
    getAllPackages,
} from '../controllers/packageController';

const router = Router();

// Public routes
router.get('/', getAllPackages);



export default router;