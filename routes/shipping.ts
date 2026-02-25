import { Router } from 'express';
import * as ctrl from '../controllers/shippingController';

const router = Router();

router.get('/provinces', ctrl.getProvinces);
router.get('/districts/:provinceId', ctrl.getDistricts);
router.get('/wards/:districtId', ctrl.getWards);
router.post('/calculate-fee', ctrl.calculateFee);

export default router;
