import { Router } from 'express';
import { 
  getSummaryStats, 
  getBicyclesStatusChart 
} from '../../controllers/admin/dashboardController';
import { validate } from '../../middleware/validate';
import { 
  summaryQuerySchema, 
  bicyclesChartQuerySchema 
} from '../../validations/summaryValidation';


const router = Router();

router.get(
  '/stats/summary',
  validate(summaryQuerySchema), 
  getSummaryStats
);


router.get(
  '/charts/bicycles',
  validate(bicyclesChartQuerySchema),
  getBicyclesStatusChart
);

export default router;