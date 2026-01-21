import { Router } from 'express';
import {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory
} from '../controllers/categoryController';
import { verifyToken, requireUser } from '../middleware/auth';
import { requireAdmin } from '../middleware/rbac';

const router = Router();

// Public routes
router.get('/', getAllCategories);           // GET /api/category
router.get('/:id', getCategoryById);         // GET /api/category/:id

// Protected routes (chỉ Admin)
router.post('/', createCategory);
router.put('/:id', updateCategory);
router.delete('/:id', deleteCategory);

export default router;