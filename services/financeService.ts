import WithdrawRequest from '../models/WithdrawRequest';
import Order from '../models/Order';
import { WithdrawalResult} from '../types/summary';

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