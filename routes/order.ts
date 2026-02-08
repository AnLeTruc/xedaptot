import { Router } from 'express';
import * as ctrl from '../controllers/orderController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, cancelOrderSchema } from '../validations/orderValidation';

const router = Router();
router.use(verifyToken, requireUser);

router.get('/me', ctrl.getMyOrders);
router.get('/:id', ctrl.getOrderById);
router.post('/', validate(createOrderSchema, 'body'), ctrl.createOrder);
router.post('/:id/pay', ctrl.payOrder);
router.put('/:id/cancel', validate(cancelOrderSchema, 'body'), ctrl.cancelOrder);
router.post('/:id/review', ctrl.reviewOrder);

// seller
router.put('/:id/confirm', ctrl.confirmOrder);  
router.put('/:id/reject', validate(cancelOrderSchema, 'body'), ctrl.rejectOrder);

// admin
router.get('/', ctrl.getAllOrders);

export default router;