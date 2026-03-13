import { Router } from 'express'
import * as ctrl from '../controllers/disputeController';
import { verifyToken, requireUser } from '../middleware/auth';
import { createDisputeSchema, resolveDisputeSchema } from '../validations/disputeValidation';
import { validate } from '../middleware/validate';


const router = Router();
router.use(verifyToken, requireUser);
router.post('/', validate(createDisputeSchema, 'body'), ctrl.createDispute);
router.get('/', ctrl.getDisputes);

export default router;
