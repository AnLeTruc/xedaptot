import { Router } from 'express';
import { 
  getSummaryStats, 
  getBicyclesStatusChart, 
  getTopBrandsChartController,
  getTopCategoriesChartController,
  getTopSellersChartController,
  getWithdrawals      
} from '../../controllers/admin/dashboardController';
import { validate } from '../../middleware/validate';
import { 
  summaryQuerySchema, 
  bicyclesChartQuerySchema, 
  topBrandsQuerySchema,
  topCategoriesQuerySchema,
  topSellersQuerySchema,
  withdrawalsQuerySchema            
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

//Top sellers
router.get(
  '/charts/top-sellers',
  validate(topSellersQuerySchema),
  getTopSellersChartController
);

//Withdraw res
router.get(
  '/finance/withdrawals',
  validate(withdrawalsQuerySchema),
  getWithdrawals
);

export default router;