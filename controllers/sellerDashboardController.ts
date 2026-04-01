import { Response } from 'express';
import { AuthRequest } from '../types';
import { fromZonedTime } from 'date-fns-tz';
import Bicycle from '../models/Bicycle';
import Order from '../models/Order';

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const SALES_STATUSES = ['COMPLETED', 'FUNDS_RELEASED'] as const;
const ACTIVE_LISTING_STATUSES = ['APPROVED', 'RESERVED'] as const;

// GET /users/seller/dashboard
export const getSellerDashboard = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const user = req.user;

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Chưa xác thực'
            });
            return;
        }

        if (!user.roles.includes('SELLER')) {
            res.status(403).json({
                success: false,
                message: 'Truy cập bị từ chối. Yêu cầu quyền người bán.'
            });
            return;
        }

        const now = new Date();
        const year = Number(req.query.year) || now.getFullYear();
        const yearStart = fromZonedTime(`${year}-01-01 00:00:00`, TIMEZONE);
        const yearEnd = fromZonedTime(`${year + 1}-01-01 00:00:00`, TIMEZONE);

        const sellerId = user._id;

        const totalListingsPromise = Bicycle.countDocuments({
            'seller._id': sellerId
        });

        const activeListingsPromise = Bicycle.countDocuments({
            'seller._id': sellerId,
            status: { $in: ACTIVE_LISTING_STATUSES }
        });

        const totalSalesPromise = Order.countDocuments({
            'seller._id': sellerId,
            status: { $in: SALES_STATUSES }
        });

        const revenuePromise = Order.aggregate([
            {
                $match: {
                    'seller._id': sellerId,
                    status: { $in: SALES_STATUSES }
                }
            },
            {
                $group: {
                    _id: null,
                    revenue: { $sum: '$amounts.total' }
                }
            }
        ]);

        const pendingOrdersPromise = Order.countDocuments({
            'seller._id': sellerId,
            status: 'WAITING_SELLER_CONFIRMATION'
        });

        const revenueChartPromise = Order.aggregate([
            {
                $match: {
                    'seller._id': sellerId,
                    status: { $in: SALES_STATUSES },
                    updatedAt: { $gte: yearStart, $lt: yearEnd }
                }
            },
            {
                $group: {
                    _id: {
                        month: { $month: { date: '$updatedAt', timezone: TIMEZONE } }
                    },
                    revenue: { $sum: '$amounts.total' }
                }
            },
            {
                $project: {
                    _id: 0,
                    month: '$_id.month',
                    revenue: 1
                }
            },
            {
                $sort: { month: 1 }
            }
        ]);

        const recentOrdersPromise = Order.find({
            'seller._id': sellerId
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('orderCode status amounts.total buyer.fullName bicycle.title createdAt')
            .lean();

        const topListingsPromise = Order.aggregate([
            {
                $match: {
                    'seller._id': sellerId,
                    status: { $in: SALES_STATUSES }
                }
            },
            {
                $group: {
                    _id: '$bicycle._id',
                    title: { $first: '$bicycle.title' },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { orderCount: -1 } },
            { $limit: 5 },
            {
                $project: {
                    _id: 0,
                    bicycleId: { $toString: '$_id' },
                    title: 1,
                    orderCount: 1
                }
            }
        ]);

        const [
            totalListings,
            activeListings,
            totalSales,
            revenueResult,
            pendingOrders,
            revenueChartRaw,
            recentOrdersRaw,
            topListings
        ] = await Promise.all([
            totalListingsPromise,
            activeListingsPromise,
            totalSalesPromise,
            revenuePromise,
            pendingOrdersPromise,
            revenueChartPromise,
            recentOrdersPromise,
            topListingsPromise
        ]);

        const revenue = revenueResult?.[0]?.revenue ?? 0;

        const revenueChart = Array.from({ length: 12 }, (_, index) => {
            const month = index + 1;
            const found = revenueChartRaw.find((item: any) => item.month === month);
            return {
                month,
                revenue: found ? found.revenue : 0
            };
        });

        const recentOrders = recentOrdersRaw.map((order: any) => ({
            orderCode: order.orderCode,
            status: order.status,
            total: order.amounts?.total ?? 0,
            buyerName: order.buyer?.fullName ?? '',
            bicycleTitle: order.bicycle?.title ?? '',
            createdAt: order.createdAt
        }));

        res.status(200).json({
            success: true,
            data: {
                totalListings,
                activeListings,
                totalSales,
                revenue,
                pendingOrders,
                revenueChart,
                recentOrders,
                topListings
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi hệ thống'
        });
    }
};
