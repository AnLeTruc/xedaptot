import Bicycle from '../models/Bicycle';
import Brand from '../models/Brand';
import { BicyclesChartResult,  BrandChartResult, BrandChartItem} from '../types/summary';

//Ratio bicycles by status
export const getBicyclesChart = async (
  year?: number
): Promise<BicyclesChartResult> => {

  const matchStage: Record<string, unknown> = {};

  if (year) {
    matchStage.createdAt = {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31T23:59:59`)
    };
  }

  //aggregate group status
  const result = await Bicycle.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        count: 1
      }
    }
  ]);

  //Always return 3 status with count = 0
  const statuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
  const data = statuses.map((status) => ({
    status,
    count: result.find((r) => r.status === status)?.count ?? 0
  }));

  const total = data.reduce((sum, item) => sum + item.count, 0);

  return { data, total };
};

//Top brands
export const getTopBrandsChart = async (
  limit: number = 5,
  status: string = 'APPROVED',
  year?: number
): Promise<BrandChartResult> => {

  const matchStage: Record<string, unknown> = {};
  
  if (status !== 'ALL') matchStage.status = status;
  if (year) {
    matchStage.createdAt = {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31T23:59:59`)
    };
  }

  const result = await Bicycle.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$brand._id',
        brandName: { $first: '$brand.name' }, 
        count: { $sum: 1 }
      }
    },

    { $sort: { count: -1 } },
    { $limit: limit }
  ]);

  const total = result.reduce((sum, item) => sum + item.count, 0);

  const data: BrandChartItem[] = result.map((item) => ({
    brandId: item._id?.toString() ?? 'unknown',
    brandName: item.brandName ?? 'Unknown',
    count: item.count,
    percentage: total > 0
      ? Math.round((item.count / total) * 100 * 10) / 10
      : 0
  }));

  return { data, total };
};
