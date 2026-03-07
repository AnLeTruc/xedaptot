import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import UserPackage from '../models/UserPackage';
import Package from '../models/Package';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import { getOrCreateWallet } from './walletController';
import mongoose from 'mongoose';

const generateCode = (prefix: string) => {
    const d = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    return `${prefix}-${d}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
};



// GET /api/user-packages/me
// Get all packages for current user
export const getMyPackages = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        const { status } = req.query;

        const query: any = { userId };
        if (status) {
            query.status = status;
        }

        const packages = await UserPackage.find(query)
            .sort({ purchasedAt: -1 });

        res.status(200).json({
            success: true,
            count: packages.length,
            data: packages
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// GET /api/user-packages/me/active
// Get current user's active package
export const getMyActivePackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;

        const activePackage = await UserPackage.findOne({
            userId,
            status: 'ACTIVE'
        });

        if (!activePackage) {
            res.status(404).json({
                success: false,
                message: 'No active package found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: activePackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// GET /api/user-packages/:id
// Get user package by ID
export const getUserPackageById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const userPackage = await UserPackage.findOne({
            _id: id,
            userId
        });

        if (!userPackage) {
            res.status(404).json({
                success: false,
                message: 'User package not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: userPackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// POST /api/user-packages/purchase
// Purchase a new package
export const purchasePackage = async (req: AuthRequest, res: Response): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const userId = req.user?._id;
        const { packageId } = req.body;

        if (!packageId) {
            await session.abortTransaction(); session.endSession();
            res.status(400).json({ success: false, message: 'Package ID is required' });
            return;
        }

        // Kiểm tra user đã có gói ACTIVE chưa
        const existingActive = await UserPackage.findOne({ userId, status: 'ACTIVE' }).session(session);
        if (existingActive) {
            await session.abortTransaction(); session.endSession();
            res.status(400).json({ success: false, message: 'You already have an active package. Please cancel it first.' });
            return;
        }

        // Tìm package
        const packageItem = await Package.findById(packageId).session(session);
        if (!packageItem) {
            await session.abortTransaction(); session.endSession();
            res.status(404).json({ success: false, message: 'Package not found' });
            return;
        }
        if (!packageItem.isActive) {
            await session.abortTransaction(); session.endSession();
            res.status(400).json({ success: false, message: 'This package is not available' });
            return;
        }

        // Lấy ví
        await getOrCreateWallet(userId as mongoose.Types.ObjectId);
        const walletDoc = await Wallet.findOne({ userId }).session(session);
        if (!walletDoc) {
            await session.abortTransaction(); session.endSession();
            res.status(500).json({ success: false, message: 'Wallet not found' });
            return;
        }

        // Kiểm tra số dư
        const availableBalance = walletDoc.totalEarn - walletDoc.totalWithdrawn - walletDoc.frozenBalance;
        if (availableBalance < packageItem.price) {
            await session.abortTransaction(); session.endSession();
            res.status(400).json({
                success: false,
                message: `Số dư không đủ. Cần: ${packageItem.price.toLocaleString('vi-VN')}đ, Khả dụng: ${availableBalance.toLocaleString('vi-VN')}đ`
            });
            return;
        }

        // Tạo Transaction
        const [transaction] = await Transaction.create([{
            transactionCode: generateCode('PKG'),
            paymentMethod: 'WALLET',
            walletId: walletDoc._id,
            type: 'PACKAGE_PURCHASE',
            amount: packageItem.price,
            balanceBefore: availableBalance,
            balanceAfter: availableBalance - packageItem.price,
            description: `Mua gói đăng tin: ${packageItem.name} (${packageItem.code})`
        }], { session });

        // Trừ ví
        walletDoc.totalWithdrawn += packageItem.price;
        await walletDoc.save({ session });

        // Tạo UserPackage
        const [userPackage] = await UserPackage.create([{
            userId,
            packageId: packageItem._id,
            package: { _id: packageItem._id, name: packageItem.name, code: packageItem.code, postLimit: packageItem.postLimit },
            postedUsed: 0,
            postRemaining: packageItem.postLimit,
            status: 'ACTIVE',
            purchasedAt: new Date(),
            transactionId: transaction._id
        }], { session });

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: 'Mua gói thành công',
            data: {
                userPackage,
                transaction: {
                    code: transaction.transactionCode,
                    amount: transaction.amount,
                    balanceBefore: transaction.balanceBefore,
                    balanceAfter: transaction.balanceAfter
                }
            }
        });
    } catch (error: any) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ success: false, message: error.message });
    }
};



// PATCH /api/user-packages/:id/cancel
// Cancel a user package
export const cancelUserPackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const userPackage = await UserPackage.findOne({
            _id: id,
            userId
        });

        if (!userPackage) {
            res.status(404).json({
                success: false,
                message: 'User package not found'
            });
            return;
        }

        if (userPackage.status !== 'ACTIVE') {
            res.status(400).json({
                success: false,
                message: 'Only active packages can be cancelled'
            });
            return;
        }

        userPackage.status = 'CANCELLED';
        await userPackage.save();

        res.status(200).json({
            success: true,
            message: 'Package cancelled successfully',
            data: userPackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};





// GET /api/user-packages (Admin only - Xem tất cả gói của tất cả user)
export const getAllUserPackages = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { userId, status, page = 1, limit = 20 } = req.query;

        const query: Record<string, any> = {};
        if (userId) query.userId = userId;
        if (status) query.status = status;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const [packages, total] = await Promise.all([
            UserPackage.find(query)
                .populate('userId', 'fullName email')
                .sort({ purchasedAt: -1 })
                .skip(skip)
                .limit(limitNum),
            UserPackage.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: packages.length,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            data: packages
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};