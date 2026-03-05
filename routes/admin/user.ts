import { Router } from 'express';
import {
    getAllUsers,
    getUserById,
    updateUser,
    deactivateUser,
    getUserDashboard
} from '../../controllers/admin/userController';
import { verifyToken, requireAdmin } from '../../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(verifyToken, requireAdmin);

// User management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deactivateUser);
router.get('/users/dashboard', getUserDashboard);

export default router;
