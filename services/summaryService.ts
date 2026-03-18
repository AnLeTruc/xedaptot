import User from '../models/User';
import Listing from '../models/Bicycle';
import Order from '../models/Order';
import UserPackage from '../models/UserPackage';
import Transaction from '../models/Transaction';
import { getDateRange } from '../utils/dateRange';

export interface SummaryResult {
  totalUsers: {
    total: number;
    new: number;
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

  const listingFilter: Record<string, unknown> = { status: 'APPROVED' };
  if (dateRange) {
    listingFilter.updatedAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const activeListings = await Listing.countDocuments(listingFilter);

  const packageRevenueFilter: Record<string, unknown> = {
    type: 'PACKAGE_PURCHASE',
    'data.status': 'SUCCESS',
  };
  if (dateRange) {
    packageRevenueFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }

  const shippingRevenueFilter: Record<string, unknown> = {
    status: { $in: ['COMPLETED', 'FUNDS_RELEASED'] },
    'amounts.shippingFee': { $gt: 0 },
  };
  if (dateRange) {
    shippingRevenueFilter.updatedAt = { $gte: dateRange.start, $lte: dateRange.end };
  }

  const [packageRevenueResult, shippingRevenueResult] = await Promise.all([
    Transaction.aggregate([
      { $match: packageRevenueFilter },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]),
    Order.aggregate([
      { $match: shippingRevenueFilter },
      { $group: { _id: null, total: { $sum: '$amounts.shippingFee' } } }
    ])
  ]);
  const totalRevenue = (packageRevenueResult[0]?.total ?? 0) + (shippingRevenueResult[0]?.total ?? 0);

  const orderFilter: Record<string, unknown> = { status: { $in: ['COMPLETED', 'FUNDS_RELEASED'] } };
  if (dateRange) {
    orderFilter.updatedAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const successOrders = await Order.countDocuments(orderFilter);

  const escrowFilter: Record<string, unknown> = { 'amounts.escrowAmount': { $gt: 0 } };
  if (dateRange) {
    escrowFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const escrowResult = await Order.aggregate([
    { $match: escrowFilter },
    { $group: { _id: null, total: { $sum: '$amounts.escrowAmount' } } }
  ]);
  const escrowAmount = escrowResult[0]?.total ?? 0;

  const subFilter: Record<string, unknown> = {
    status: 'ACTIVE',
    'package.code': { $ne: 'FREE' }
  };
  if (dateRange) {
    subFilter.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
  }
  const paidSubscriptions = await UserPackage.countDocuments(subFilter);

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