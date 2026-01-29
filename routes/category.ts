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
import { validate } from '../middleware/validate';
import {
    createCategorySchema,
    updateCategorySchema,
    getCategoriesQuerySchema,
    categoryIdParamSchema
} from '../validations/categoryValidation';

const router = Router();

// Public routes
router.get('/', validate(getCategoriesQuerySchema, 'query'), getAllCategories);           // GET /api/category
router.get('/:id', validate(categoryIdParamSchema, 'params'), getCategoryById);         // GET /api/category/:id

// Protected routes (chỉ Admin)
router.post('/', validate(createCategorySchema, 'body'), createCategory);
router.put('/:id', validate(updateCategorySchema, 'body'), updateCategory);
router.delete('/:id', deleteCategory);

export default router;