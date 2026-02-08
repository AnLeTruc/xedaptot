import { Router } from 'express';
import * as ctrl from '../controllers/orderController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema } from '../validations/orderValidation';

const router = Router();
router.use(verifyToken, requireUser);

router.get('/me', ctrl.getMyOrders);
router.get('/:id', ctrl.getOrderById);
router.post('/', validate(createOrderSchema, 'body'), ctrl.createOrder);
router.post('/:id/pay', ctrl.payOrder);
router.put('/:id/confirm', ctrl.confirmOrder);  // Đổi POST → PUT

export default router;