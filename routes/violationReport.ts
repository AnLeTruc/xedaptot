import { Router } from 'express';
import * as ctrl from '../controllers/violationReportController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
    createViolationReportSchema,
} from '../validations/violationReportValidation';

const router = Router();

router.use(verifyToken, requireUser);

router.post(
    '/',
    validate(createViolationReportSchema, 'body'),
    ctrl.createViolationReport
);


export default router;
