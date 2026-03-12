import { Router } from 'express';
import { 
  getSummaryStats, 
  getBicyclesStatusChart, 
  getTopBrandsChartController
} from '../../controllers/admin/dashboardController';
import { validate } from '../../middleware/validate';
import { 
  summaryQuerySchema, 
  bicyclesChartQuerySchema, 
  topBrandsQuerySchema
} from '../../validations/summaryValidation';


const router = Router();

//Bicyles Status
router.get(
  '/stats/summary',
  validate(summaryQuerySchema), 
  getSummaryStats
);

//Bicyles Status Chart
router.get(
  '/charts/bicycles',
  validate(bicyclesChartQuerySchema),
  getBicyclesStatusChart
);

//Top brand chart
router.get(
  '/charts/top-brands',
  validate(topBrandsQuerySchema),
  getTopBrandsChartController
);

export default router;