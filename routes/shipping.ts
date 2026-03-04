import { Router } from 'express';
import * as ctrl from '../controllers/shippingController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.get('/provinces', ctrl.getProvinces);
router.get('/districts/:provinceId', ctrl.getDistricts);
router.get('/wards/:districtId', ctrl.getWards);
router.post('/calculate-fee', ctrl.calculateFee);
router.post('/calculate-fee-for-bicycle', verifyToken, requireUser, ctrl.calculateFeeForBicycle);

export default router;
