import WithdrawRequest from '../models/WithdrawRequest';
import Order from '../models/Order';
import { AOVResult, WithdrawalResult} from '../types/summary';

// Withdraw req
export const getWithdrawalsStats = async (
  year?: number
): Promise<WithdrawalResult> => {

  const matchStage: Record<string, unknown> = {
    status: 'PENDING'
  };

  if (year) {
    matchStage.createdAt = {
      $gte: new Date(`${year}-01-01`),
      $lte: new Date(`${year}-12-31T23:59:59`)
    };
  }

  const result = await WithdrawRequest.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalPending: { $sum: 1 },
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);

  return {
    totalPending: result[0]?.totalPending ?? 0,
    totalAmount: result[0]?.totalAmount ?? 0
  };
};

//AOV
export const getAOVStats = async (
  year?: number
): Promise<AOVResult> => {

  const matchStage: Record<string, unknown> = {
    status: { $in: ['COMPLETED', 'FUNDS_RELEASED'] }
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
        _id: null,
        totalRevenue: { $sum: '$amounts.total' },  
        totalOrders: { $sum: 1 }
      }
    }
  ]);

  const totalRevenue = result[0]?.totalRevenue ?? 0;
  const totalOrders = result[0]?.totalOrders ?? 0;

  return {
    totalRevenue,
    totalOrders,
    aov: totalOrders > 0
      ? Math.round(totalRevenue / totalOrders)
      : 0
  };
};