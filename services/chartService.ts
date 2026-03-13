import Bicycle from '../models/Bicycle';
import Brand from '../models/Brand';
import Order from '../models/Order';
import { 
    BicyclesChartResult,
    BrandChartResult, 
    BrandChartItem,
    TopCategoriesResult,
    CategoryChartItem,
    TopSellersResult,
    SellerChartItem 
} from '../types/summary';

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
    { $limit: Number(limit) }
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

//Top category
export const getTopCategoriesChart = async (
  limit: number = 5,
  status: string = 'APPROVED',
  year?: number
): Promise<TopCategoriesResult> => {

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
        _id: '$category._id',
        categoryName: { $first: '$category.name' },
        count: { $sum: 1 }
      }
    },

    { $sort: { count: -1 } },
    { $limit: Number(limit) }
  ]);

  const total = result.reduce((sum, item) => sum + item.count, 0);

  const data: CategoryChartItem[] = result.map((item) => ({
    categoryId: item._id?.toString() ?? 'unknown',
    categoryName: item.categoryName ?? 'Unknown',
    count: item.count,
    percentage: total > 0
      ? Math.round((item.count / total) * 100 * 10) / 10
      : 0
  }));

  return { data, total };
};

//Top sellers
export const getTopSellersChart = async (
  limit: number = 5,
  year?: number
): Promise<TopSellersResult> => {

  const matchStage: Record<string, unknown> = {
    status: 'DELIVERED' //Success order
  };

    if (year) {
        matchStage.updatedAt = {
        $gte: new Date(`${year}-01-01`),
        $lte: new Date(`${year}-12-31T23:59:59`)
        };
  }

  const result = await Order.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$seller._id',
        sellerName: { $first: '$seller.fullName' },
        avatarUrl: { $first: '$seller.avatarUrl' },
        successOrders: { $sum: 1 }
      }
    },

    { $sort: { successOrders: -1 } },
    { $limit: Number(limit) }
  ]);

  const total = result.reduce((sum, item) => sum + item.successOrders, 0);

  const data: SellerChartItem[] = result.map((item) => ({
    sellerId: item._id?.toString() ?? 'unknown',
    sellerName: item.sellerName ?? 'Unknown',
    avatarUrl: item.avatarUrl ?? '',
    successOrders: item.successOrders,
    percentage: total > 0
      ? Math.round((item.successOrders / total) * 100 * 10) / 10
      : 0
  }));

  return { data, total };
};

