import { Response } from 'express';
import { AuthRequest } from '../../types';
import mongoose from 'mongoose';
import User from '../../models/User';
import Order from '../../models/Order';
import Bicycle from '../../models/Bicycle';
import Wallet from '../../models/Wallet';
import Transaction from '../../models/Transaction';
import * as notificationService from '../../services/notificationService';
import { fromZonedTime } from "date-fns-tz";

const generateCode = (prefix: string) => {
    const d = new Date().toISOString().replace(/[-T:.Z]/g, '');
    return `${prefix}-${d}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
};

// GET /admin/users - Get all users with filters & pagination
export const getAllUsers = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const {
            role,
            isActive,
            search,
            page = '1',
            limit = '10',
            sort = '-createdAt'
        } = req.query;

        const query: any = {};

        // Filter by role
        if (role) {
            query.roles = role;
        }

        // Filter by active status
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        // Search by name or email
        if (search && typeof search === 'string') {
            query.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, +page);
        const limitNum = Math.min(50, Math.max(1, +limit));

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-passwordResetCodeHash -passwordResetTokenHash -emailVerificationToken')
                .sort(sort as string)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            User.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            data: {
                users,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /admin/users/:id - Get user by ID with stats
export const getUserById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select('-passwordResetCodeHash -passwordResetTokenHash -emailVerificationToken');

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
            return;
        }

        // Get user stats in parallel
        const [
            totalOrders,
            totalBicycles,
            activeBicycles,
            wallet
        ] = await Promise.all([
            Order.countDocuments({
                $or: [{ 'buyer._id': id }, { 'seller._id': id }]
            }),
            Bicycle.countDocuments({ 'seller._id': id }),
            Bicycle.countDocuments({ 'seller._id': id, status: 'APPROVED' }),
            Wallet.findOne({ userId: id })
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...user.toObject(),
                stats: {
                    totalOrders,
                    totalBicycles,
                    activeBicycles,
                    walletBalance: wallet?.availableBalance ?? 0
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// PATCH /admin/users/:id - Update user
export const updateUser = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { fullName, phone, isActive, roles } = req.body;

        const updateData: any = {};
        if (fullName !== undefined) updateData.fullName = fullName;
        if (phone !== undefined) updateData.phone = phone;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (roles !== undefined) updateData.roles = roles;

        const user = await User.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).select('-passwordResetCodeHash -passwordResetTokenHash -emailVerificationToken');

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật người dùng thành công',
            data: user
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// DELETE /admin/users/:id - Deactivate user (soft delete)
export const deactivateUser = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        // Prevent admin from deactivating themselves
        if (id === req.user?._id?.toString()) {
            res.status(400).json({
                success: false,
                message: 'Không thể vô hiệu hoá tài khoản của chính bạn'
            });
            return;
        }

        const user = await User.findByIdAndUpdate(
            id,
            { isActive: false },
            { new: true }
        );

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
            return;
        }

        if (user.roles.includes('SELLER')) {
            // Cập nhật trạng thái xe đã đăng
            await Bicycle.updateMany(
                { 'seller._id': id, status: 'APPROVED' },
                { $set: { status: 'HIDDEN' } }
            );

            await Bicycle.updateMany(
                { 'seller._id': id, status: 'PENDING' },
                { $set: { status: 'REJECTED', rejectReason: 'Tài khoản người bán đang bị khóa' } }
            );

            // Chuyển đơn hàng đang chờ xác nhận sang hủy và hoàn tiền
            const waitingOrders = await Order.find({ 'seller._id': id, status: 'WAITING_SELLER_CONFIRMATION' });

            for (const order of waitingOrders) {
                const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
                const refund = order.amounts.escrowAmount;

                if (refund > 0 && buyerWallet) {
                    const buyerBalBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
                    buyerWallet.frozenBalance -= refund;
                    await buyerWallet.save();

                    const txnCode = generateCode('TXN');
                    await Transaction.create({
                        transactionCode: txnCode,
                        paymentMethod: 'SYSTEM',
                        walletId: buyerWallet._id,
                        type: 'REFUND',
                        amount: refund,
                        balanceBefore: buyerBalBefore,
                        balanceAfter: buyerBalBefore + refund,
                        description: `Seller deactivated - Refund - ${order.orderCode}`,
                        orderId: order._id,
                    });

                    order.transactions.push({
                        transactionCode: txnCode, type: 'REFUND', amount: refund, status: 'SUCCESS',
                        createdAt: new Date(), walletId: buyerWallet._id, paymentMethod: 'SYSTEM',
                        balanceBefore: buyerBalBefore, balanceAfter: buyerBalBefore + refund,
                        description: `Seller deactivated - Refund - ${order.orderCode}`,
                        paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
                    } as any);
                }

                order.status = 'REJECTED';
                order.cancelledAt = new Date();
                order.cancelReason = 'Tài khoản người bán đang bị khóa';
                order.amounts.escrowAmount = 0;
                await order.save();

                // Đổi trạng thái xe trong đơn hàng đó từ RESERVED về HIDDEN luôn
                await Bicycle.updateMany(
                    { _id: order.bicycle._id },
                    { $set: { status: 'HIDDEN' } }
                );

                notificationService.notifyOrderRejected(
                    order.buyer._id.toString(),
                    order._id.toString(),
                    order.orderCode
                );
            }
        }

        res.status(200).json({
            success: true,
            message: 'Vô hiệu hoá người dùng thành công'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

//GET /admin/users/dashboard - Get user dashboard
export const getUserDashboard = async (
    req: AuthRequest,
    res: Response
): Promise <void> => {
    try{
        const timezone = "Asia/Ho_Chi_Minh";
        const now = new Date();

        const year = Number(req.query.year) || now.getFullYear();
        const yearStart = fromZonedTime(`${year}-01-01 00:00:00`, timezone);
        const yearEnd = fromZonedTime(`${year + 1}-01-01 00:00:00`, timezone);

        const [stats] = await User.aggregate([
            {
                $facet: {
                    totalUsers: [{
                        $count: "count"
                    }],
                    activeUsers: [{
                        $match: {
                            isActive: true
                        }
                    },
                    {
                            $count: "count"
                    }],
                    inactiveUsers: [{
                        $match: {
                            isActive: false
                        }
                        
                    },
                    {
                        $count: "count"
                    }],
                    roleDistribution: [
                        {
                            $unwind: "$roles"
                        },
                        {
                            $group: {
                                _id: "$roles",
                                count: {
                                    $sum: 1
                                }
                            }
                        },
                        {
                            $project:{
                                _id: 0,
                                role: "$_id",
                                count: 1
                            }
                        },
                        {
                            $sort: {
                                role: 1
                            }
                        }    
                    ],
                    usersByMonth: [
                        {
                            $match: {
                               createdAt: {
                                    $gte: yearStart,
                                    $lt: yearEnd
                               }
                            }
                        },
                        {
                            $group: {
                                _id: {
                                    month: {
                                        $month: { date: "$createdAt", timezone }
                                    }
                                },
                                count: {
                                    $sum: 1
                                }
                            }
                        },
                        {
                            $project: {
                            _id: 0,
                            month: "$_id.month",
                            count: 1
                            }
                        },
                        {
                            $sort: {
                                month :1
                            }
                        }  
                    ]
                }
            }
        ]);

        const monthCheck = Array.from({ length: 12 }, (_, i) => {
            const month = i + 1;
            const found = stats?.usersByMonth?.find((doc: any) => doc.month === month);
            return { month, count: found ? found.count : 0 };
        });

        res.status(200).json({
            success: true,
            data: {
                year,
                totalUsers: stats?.totalUsers?.[0]?.count ?? 0,
                activeUsers: stats?.activeUsers?.[0]?.count ?? 0,
                inactiveUsers: stats?.inactiveUsers?.[0]?.count ?? 0,
                roleDistribution: stats?.roleDistribution ?? [],
                usersByMonth: monthCheck

            }
        })
    } catch (error: any){
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
};