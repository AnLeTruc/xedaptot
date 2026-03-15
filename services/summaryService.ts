import User from '../models/User';
import Listing from '../models/Bicycle';
import Order from '../models/Order';
import Subscription from '../models/Package';
import Transaction from '../models/Transaction';
import { getDateRange } from '../utils/dateRange';

export interface SummaryResult {
  totalUsers: {
    total: number;
    new: number; // user mới trong kỳ
  };
  activeListings: number;
  totalRevenue: number;
  successOrders: number;
  escrowAmount: number;
  paidSubscriptions: number;
  period: string;
  year?: number;
}

export const getSummaryData = async (
  period: string,
  year?: number
): Promise<SummaryResult> => {

  const dateRange = getDateRange(period, year);

  //totalUsers
  const userFilter: Record<string, unknown> = {
    roles: { $nin: ['admin', 'inspector'] }
  };
  if (dateRange) {
    userFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }

  const [totalUsersAll, newUsersInPeriod] = await Promise.all([
    User.countDocuments({ roles: { $nin: ['admin', 'inspector'] } }),
    dateRange ? User.countDocuments(userFilter) : 0
  ]);

  //activeListings
  const listingFilter: Record<string, unknown> = { status: 'APPROVED' };
  if (dateRange) {
    listingFilter.approvedAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const activeListings = await Listing.countDocuments(listingFilter);

  //totalRevenue — doanh thu từ gói đăng tin đã thanh toán qua VNPay
  const revenueFilter: Record<string, unknown> = {
    type: 'PACKAGE_PURCHASE',
    'data.status': 'SUCCESS',
  };
  if (dateRange) {
    revenueFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const revenueResult = await Transaction.aggregate([
    { $match: revenueFilter },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ]);
  const totalRevenue = revenueResult[0]?.total ?? 0;

  //successOrders
  const orderFilter: Record<string, unknown> = { status: 'success' };
  if (dateRange) {
    orderFilter.completedAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const successOrders = await Order.countDocuments(orderFilter);

  //escrowAmount
  const escrowFilter: Record<string, unknown> = { 'amounts.escrowAmount': { $gt: 0 } };
  if (dateRange) {
    escrowFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const escrowResult = await Order.aggregate([
    { $match: escrowFilter },
    { $group: { _id: null, total: { $sum: '$amounts.escrowAmount' } } }
  ]);
  const escrowAmount = escrowResult[0]?.total ?? 0;

  // paidSubscriptions
  const subFilter: Record<string, unknown> = { type: 'upgrade' };
  if (dateRange) {
    subFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const paidSubscriptions = await Subscription.countDocuments(subFilter);

  return {
    totalUsers: {
      total: totalUsersAll,
      new: newUsersInPeriod
    },
    activeListings,
    totalRevenue,
    successOrders,
    escrowAmount,
    paidSubscriptions,
    period,
    ...(year && { year })
  };
};