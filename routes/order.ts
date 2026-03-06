import { Router } from 'express';
import * as ctrl from '../controllers/orderController';
import { verifyToken, requireUser } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createOrderSchema, cancelOrderSchema } from '../validations/orderValidation';

const router = Router();

// VNPay callbacks - NO AUTH (VNPay gọi trực tiếp, không có JWT)
router.get('/vnpay-return', ctrl.vnpayOrderReturn);
router.get('/vnpay-ipn', ctrl.vnpayOrderIPN);

// Tất cả routes bên dưới CẦN đăng nhập
router.use(verifyToken, requireUser);

router.get('/me', ctrl.getMyOrders);
router.get('/:id', ctrl.getOrderById);
router.post('/', validate(createOrderSchema, 'body'), ctrl.createOrder);
router.post('/:id/pay', ctrl.payOrder);
router.post('/:id/pay-vnpay', ctrl.payOrderVnpay);
router.put('/:id/cancel', validate(cancelOrderSchema, 'body'), ctrl.cancelOrder);
router.post('/:id/review', ctrl.reviewOrder);
router.put('/:id/receive', ctrl.receiveOrder);

// seller
router.put('/:id/confirm', ctrl.confirmOrder);
router.put('/:id/reject', validate(cancelOrderSchema, 'body'), ctrl.rejectOrder);

// admin
router.get('/', ctrl.getAllOrders);
router.put('/:id/pickup', ctrl.pickupOrder);
router.put('/:id/ship', ctrl.shipOrder);
router.put('/:id/deliver', ctrl.deliverOrder);

export default router;
