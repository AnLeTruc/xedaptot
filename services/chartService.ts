import Bicycle from '../models/Bicycle';
import { BicyclesChartResult } from '../types/summary';

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