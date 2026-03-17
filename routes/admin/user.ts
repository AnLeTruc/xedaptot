import { Router } from 'express';
import {
    getAllUsers,
    getUserById,
    updateUser,
    deactivateUser,
    getUserDashboard
} from '../../controllers/admin/userController';
import { getAllUserPackages } from '../../controllers/userPackageController';
import { verifyToken, requireAdmin } from '../../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(verifyToken, requireAdmin);

// User management
router.get('/users/dashboard', getUserDashboard);
router.get('/users', getAllUsers);
router.get('/users/:id', getUserById);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deactivateUser);

// Package management (Admin)
router.get('/user-packages', getAllUserPackages);


export default router;
