import { Router } from 'express';
import {
    getMyBicycles,
    getAllBicycles,
    getBicycleById,
    createBicycle,
    updateBicycle,
    deleteBicycle,
    getBicycleStatus,
    requestInspection,
    resubmitBicycle
} from '../controllers/bicycleController';
import { verifyToken, requireUser, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    createBicycleSchema,
    updateBicycleSchema,
    updateBicycleStatusSchema,
    getBicyclesQuerySchema,
    getMyBicyclesQuerySchema,
    bicycleIdParamSchema
} from '../validations/bicycleValidation';


const router = Router();

// Public routes
router.get('/',
    optionalAuth,
    validate(getBicyclesQuerySchema, 'query'),
    getAllBicycles
);


// Protected: Get my bicycles (must be before /:id)
router.get('/my',
    verifyToken,
    requireUser,
    validate(getMyBicyclesQuerySchema, 'query'),
    getMyBicycles
);

router.get('/:id',
    optionalAuth,
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
            })
            .sort({ createdAt: -1 })
            .populate('inspectorId', 'fullName');

            if (!report) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy báo cáo kiểm định cho xe đạp này'
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

// Seller request inspection
router.post('/:id/request-inspection',
    verifyToken,
    requireUser,
    validate(bicycleIdParamSchema, 'params'),
    requestInspection
);


router.post('/:id/resubmit',
    verifyToken,
    requireUser,
    validate(bicycleIdParamSchema, 'params'),
    resubmitBicycle
);

export default router;