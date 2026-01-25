import { Router } from 'express';
import { getAllBicycles, getBicycleById, createBicycle, updateBicycle, deleteBicycle, getBicycleStatus } from '../controllers/bicycleController';
import { verifyToken, requireUser } from '../middleware/auth';


const router = Router();

router.get('/', getAllBicycles);
router.get('/:id', getBicycleById);

router.post('/', verifyToken, requireUser, createBicycle);
router.put('/:id', verifyToken, requireUser, updateBicycle);
router.delete('/:id', verifyToken, requireUser, deleteBicycle);
router.put('/:id/status', verifyToken, requireUser, getBicycleStatus);

export default router;