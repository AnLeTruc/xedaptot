import { Router } from 'express';
import * as ctrl from '../controllers/violationReportController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    createViolationReportSchema,
    updateViolationReportSchema
} from '../validations/violationReportValidation';

const router = Router();

router.use(verifyToken, requireUser);

router.get('/me', ctrl.getMyViolationReports);

router.post(
    '/',
    validate(createViolationReportSchema, 'body'),
    ctrl.createViolationReport
);


export default router;
