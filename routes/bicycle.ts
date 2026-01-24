import { Router } from 'express';
import { getAllBicycles, getBicycleById, createBicycle } from '../controllers/bicycleController';
import { verifyToken, requireUser } from '../middleware/auth';


const router = Router();

router.get('/', getAllBicycles);
router.get('/:id', getBicycleById);

router.post('/', verifyToken, requireUser, createBicycle);
export default router;