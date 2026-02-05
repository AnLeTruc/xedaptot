import { Router } from 'express';
import { createOrder } from '../controllers/orderController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema } from '../validations/orderValidation';

const router = Router();
router.use(verifyToken, requireUser);

router.post('/', validate(createOrderSchema, 'body'), createOrder);

export default router;