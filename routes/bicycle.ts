import { Router } from 'express';
import { getAllBicycles, getBicycleById, createBicycle, updateBicycle, deleteBicycle } from '../controllers/bicycleController';
import { verifyToken, requireUser } from '../middleware/auth';


const router = Router();

router.get('/', getAllBicycles);
router.get('/:id', getBicycleById);

router.post('/', verifyToken, requireUser, createBicycle);
router.put('/:id', verifyToken, requireUser, updateBicycle);
router.delete('/:id', verifyToken, requireUser, deleteBicycle);
export default router;