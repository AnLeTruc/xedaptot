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

// Public: Get inspection report for a bicycle
router.get('/:id/inspection-report',
    validate(bicycleIdParamSchema, 'params'),
    async (req, res) => {
        const InspectionReport = require('../models/InspectionReport').default;
        try {
            const { id } = req.params;
            const report = await InspectionReport.findOne({
                bicycleId: id,
                status: { $in: ['COMPLETED', 'REJECTED'] }
            }).populate('inspectorId', 'fullName');

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'No inspection report found for this bicycle'
                });
            }

            res.status(200).json({
                success: true,
                data: report
            });
        } catch (error: any) {
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
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