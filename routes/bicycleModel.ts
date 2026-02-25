import { Router } from 'express';
import {
    getAllBicycleModels,
    createBicycleModels
} from '../controllers/bicycleModelController';
import { validate } from '../middleware/validate';
import { getBicycleModelsQuerySchema, createBicycleModelSchema } from '../validations/bicycleModelValidation';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.get('/', validate(getBicycleModelsQuerySchema, 'query'), getAllBicycleModels);
router.post('/', verifyToken, requireUser, validate(createBicycleModelSchema, 'body'), createBicycleModels);
export default router;