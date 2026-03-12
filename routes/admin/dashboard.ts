import { Router } from 'express';
import { 
  getSummaryStats, 
  getBicyclesStatusChart, 
  getTopBrandsChartController,
  getTopCategoriesChartController  
} from '../../controllers/admin/dashboardController';
import { validate } from '../../middleware/validate';
import { 
  summaryQuerySchema, 
  bicyclesChartQuerySchema, 
  topBrandsQuerySchema,
  topCategoriesQuerySchema  
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

//Top cate
router.get(
  '/charts/top-categories',
  validate(topCategoriesQuerySchema),
  getTopCategoriesChartController
);

export default router;