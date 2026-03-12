import { Router } from 'express';
import { getSummaryStats } from '../../controllers/admin/dashboardController';
import { validate } from '../../middleware/validate';
import { summaryQuerySchema } from '../../validations/summaryValidation';

const router = Router();

router.get(
  '/stats/summary',
  validate(summaryQuerySchema), 
  getSummaryStats
);

export default router;