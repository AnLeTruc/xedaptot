import { Router } from 'express';
import { analyzeBike, priceSuggestion } from '../controllers/aiController';
import { verifyToken, requireUser } from '../middleware/auth';

const router = Router();

router.post('/analyze-bike', verifyToken, requireUser, analyzeBike);
router.get('/price-suggestion', verifyToken, requireUser, priceSuggestion);

export default router;