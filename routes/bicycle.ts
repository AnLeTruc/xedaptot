import { Router } from 'express';
import { getAllBicycles, getBicycleById, createBicycle, updateBicycle } from '../controllers/bicycleController';
import { verifyToken, requireUser } from '../middleware/auth';


const router = Router();

router.get('/', getAllBicycles);
router.get('/:id', getBicycleById);

router.post('/', verifyToken, requireUser, createBicycle);
router.put('/:id', verifyToken, requireUser, updateBicycle);
export default router;