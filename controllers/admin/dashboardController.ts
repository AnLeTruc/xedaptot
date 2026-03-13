import { Request, Response } from 'express';
import { getSummaryData } from '../../services/summaryService';
import { 
    getBicyclesChart,
    getTopBrandsChart,
    getTopCategoriesChart,
    getTopSellersChart,       
} from '../../services/chartService';
import { getWithdrawalsStats, getAOVStats  } from '../../services/financeService';
import { 
    TopBrandsQueryInput,
    TopCategoriesQueryInput,
    TopSellersQueryInput,
    WithdrawalsQueryInput,
    AOVQueryInput    
 } from '../../validations/summaryValidation';

export const getSummaryStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { period = 'all', year } = req.query;

    // Validate period
    const validPeriods = ['week', 'month', 'quarter', 'year', 'all'];
    if (!validPeriods.includes(period as string)) {
      res.status(400).json({
        success: false,
        message: `Period phải là một trong: ${validPeriods.join(', ')}`
      });
      return;
    }

    const summary = await getSummaryData(
      period as string,
      year ? parseInt(year as string) : undefined
    );

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

//Bicyles Status Chart
export const getBicyclesStatusChart = async (
  req: Request<any, any, any, any>,
  res: Response
): Promise<void> => {
  try {
    const { year } = req.query;

    const data = await getBicyclesChart(year);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error : any) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Top brand chart
export const getTopBrandsChartController = async (
  req: Request<{}, {}, {}, TopBrandsQueryInput>,
  res: Response
): Promise<void> => {
  try {
    const { limit = 5, status = 'APPROVED', year } = req.query;

    const data = await getTopBrandsChart(limit, status, year);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error:any) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Top cate
export const getTopCategoriesChartController = async (
  req: Request<{}, {}, {}, TopCategoriesQueryInput>,
  res: Response
): Promise<void> => {
  try {
    const { limit = 5, status = 'APPROVED', year } = req.query;

    const data = await getTopCategoriesChart(limit, status, year);

    res.status(200).json({
      success: true,
      data
    });

  } catch (error:any) {
    res.status(500).json({
      message: error.message
    });
  }
};

//Top sellers
export const getTopSellersChartController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { limit = 5, year } = req.query as unknown as TopSellersQueryInput;

    const data = await getTopSellersChart(Number(limit), year);

    res.status(200).json({ success: true, data });

  } catch (error:any) {
     res.status(500).json({
      message: error.message
    });
  }
};

//Withdraw res
export const getWithdrawals = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { year } = req.query as unknown as WithdrawalsQueryInput;

    const data = await getWithdrawalsStats(year ? Number(year) : undefined);

    res.status(200).json({ success: true, data });

  } catch (error:any) {
     res.status(500).json({
      message: error.message
    });
  }
};

//AOV
export const getAOV = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { year } = req.query as unknown as AOVQueryInput;

    const data = await getAOVStats(year ? Number(year) : undefined);

    res.status(200).json({ success: true, data });

  } catch (error:any) {
     res.status(500).json({
      message: error.message
    });
  }
};


