import { Router } from 'express';
import {
    getAllBicycles,
    getBicycleById,
    createBicycle,
    updateBicycle,
    deleteBicycle,
    getBicycleStatus
} from '../controllers/bicycleController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    createBicycleSchema,
    updateBicycleSchema,
    updateBicycleStatusSchema,
    getBicyclesQuerySchema,
    bicycleIdParamSchema
} from '../validations/bicycleValidation';


const router = Router();

// Public routes
router.get('/',
    validate(getBicyclesQuerySchema, 'query'),
    getAllBicycles
);

router.get('/:id',
    validate(bicycleIdParamSchema, 'params'),
    getBicycleById
);

// Protected routes
router.post('/',
    verifyToken,
    requireUser,
    validate(createBicycleSchema, 'body'),
    createBicycle
);

router.put('/:id',
    verifyToken,
    requireUser,
    validate(bicycleIdParamSchema, 'params'),
    validate(updateBicycleSchema, 'body'),
    updateBicycle
);

router.delete('/:id',
    verifyToken,
    requireUser,
    validate(bicycleIdParamSchema, 'params'),
    deleteBicycle
);

router.put('/:id/status',
    verifyToken,
    requireUser,
    validate(bicycleIdParamSchema, 'params'),
    validate(updateBicycleStatusSchema, 'body'),
    getBicycleStatus
);

export default router;