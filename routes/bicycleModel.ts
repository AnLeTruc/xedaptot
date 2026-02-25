import { Router } from 'express';
import {
    getAllBicycleModels,
    createBicycleModel,
    updateBicycleModel,
    deleteBicycleModel
} from '../controllers/bicycleModelController';
import { validate } from '../middleware/validate';
import {
    createBicycleModelSchema,
    updateBicycleModelSchema,
    bicycleModelIdParamSchema,
    getBicycleModelsQuerySchema
} from '../validations/bicycleModelValidation';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.get('/', validate(getBicycleModelsQuerySchema, 'query'), getAllBicycleModels);
router.post('/', verifyToken, requireUser, validate(createBicycleModelSchema, 'body'), createBicycleModel);
router.put('/:id', verifyToken, requireUser, validate(bicycleModelIdParamSchema, 'params'), validate(updateBicycleModelSchema, 'body'), updateBicycleModel);
router.delete('/:id', verifyToken, requireUser, validate(bicycleModelIdParamSchema, 'params'), deleteBicycleModel);

export default router;