import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import UserPackage from '../models/UserPackage';
import Package from '../models/Package';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import { getOrCreateWallet } from './walletController';
import { createPaymentUrl, verifyReturnUrl, getResponseMessage } from '../services/vnpayService';
import mongoose from 'mongoose';
import * as notificationService from '../services/notificationService';

const VNP_PKG_RETURN_URL = process.env.VNP_PKG_RETURN_URL

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

        // Trạng thái gói = gói mới nhất (bất kể ACTIVE/CANCELLED/EXPIRED)
        const latestPackage = await UserPackage.findOne({ userId }).sort({ purchasedAt: -1 });

        if (!latestPackage) {
            res.status(404).json({
                success: false,
                message: 'Bạn chưa có gói đăng tin nào'
            });
            return;
        }

        // Số lần đăng cộng dồn qua tất cả gói còn lượt (ACTIVE + CANCELLED)
        const [agg] = await UserPackage.aggregate([
            { $match: { userId, postRemaining: { $gt: 0 }, status: { $in: ['ACTIVE', 'CANCELLED'] } } },
            { $group: { _id: null, total: { $sum: '$postRemaining' } } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                ...latestPackage.toObject(),
                totalPostRemaining: agg?.total ?? 0
            }
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
    try {
        const userId = req.user?._id;
        const { packageId } = req.body;

        if (!packageId) {
            res.status(400).json({ success: false, message: 'Package ID is required' });
            return;
        }

        // Kiểm tra user đã có gói ACTIVE chưa (bỏ qua gói FREE)
        const existingActive = await UserPackage.findOne({
            userId,
            status: 'ACTIVE',
            'package.code': { $ne: 'FREE' }
        });
        if (existingActive) {
            res.status(400).json({ success: false, message: 'Bạn đang có gói hoạt động. Vui lòng huỷ gói hiện tại trước khi mua gói mới.' });
            return;
        }

        // Tìm package
        const packageItem = await Package.findById(packageId);
        if (!packageItem) {
            res.status(404).json({ success: false, message: 'Package not found' });
            return;
        }
        if (!packageItem.isActive) {
            res.status(400).json({ success: false, message: 'This package is not available' });
            return;
        }

        // Lấy / tạo ví
        const walletDoc = await getOrCreateWallet(userId as mongoose.Types.ObjectId);

        // Tạo giao dịch PENDING
        const txnRef = generateCode('PKG');
        const currentBalance = walletDoc.totalEarn - walletDoc.totalWithdrawn - walletDoc.frozenBalance;

        await Transaction.create({
            transactionCode: txnRef,
            paymentMethod: 'VNPAY',
            walletId: walletDoc._id,
            type: 'PACKAGE_PURCHASE',
            amount: packageItem.price,
            balanceBefore: currentBalance,
            balanceAfter: 0,    // sẽ cập nhật khi callback
            description: `Mua gói đăng tin: ${packageItem.name} (${packageItem.code})`,
            paymentGateway: 'VNPAY',
            gatewayTransactionId: '',
            gatewayResponseCode: '',
            data: {
                status: 'PENDING',
                userId: userId!.toString(),
                packageId: packageItem._id.toString(),
                packageSnapshot: {
                    _id: packageItem._id,
                    name: packageItem.name,
                    code: packageItem.code,
                    postLimit: packageItem.postLimit,
                },
            },
        });

        // Lấy IP
        let ipAddr = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || '127.0.0.1';
        if (ipAddr === '::1') ipAddr = '127.0.0.1';
        if (ipAddr.startsWith('::ffff:')) ipAddr = ipAddr.substring(7);

        const paymentUrl = createPaymentUrl({
            amount: packageItem.price,
            orderId: txnRef,
            orderInfo: `Mua+goi+${packageItem.code}`,
            ipAddr,
            returnUrl: VNP_PKG_RETURN_URL,
        });

        res.status(200).json({
            success: true,
            message: 'Khởi tạo thanh toán thành công',
            data: { paymentUrl, txnRef },
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};



// GET /api/user/vnpay-return
export const packageVnpayReturn = async (req: Request, res: Response): Promise<void> => {
    try {
        const vnpParams = req.query as Record<string, string>;

        // Verify chữ ký
        const isValid = verifyReturnUrl(vnpParams);
        if (!isValid) {
            res.status(400).json({ success: false, message: 'Invalid signature from VNPay' });
            return;
        }

        const txnRef = vnpParams['vnp_TxnRef'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const gatewayTxnId = vnpParams['vnp_TransactionNo'] || '';

        // Tìm giao dịch PENDING
        const transaction = await Transaction.findOne({
            transactionCode: txnRef,
            type: 'PACKAGE_PURCHASE',
            'data.status': 'PENDING',
        });

        if (!transaction) {
            res.status(404).json({ success: false, message: 'Transaction not found or already processed' });
            return;
        }

        const frontendUrl = process.env.FRONTEND_URL || '';

        // Thanh toán thất bại
        if (responseCode !== '00') {
            transaction.data = { ...transaction.data, status: 'FAILED' };
            transaction.gatewayResponseCode = responseCode;
            transaction.gatewayTransactionId = gatewayTxnId;
            await transaction.save();

            if (frontendUrl) {
                res.redirect(`${frontendUrl}/packages?purchase=failed&code=${responseCode}`);
            } else {
                res.status(400).json({
                    success: false,
                    message: getResponseMessage(responseCode),
                    data: { txnRef, responseCode },
                });
            }
            return;
        }

        // Thanh toán thành công → kích hoạt gói
        const { userId, packageId, packageSnapshot } = transaction.data as {
            userId: string;
            packageId: string;
            packageSnapshot: { _id: string; name: string; code: string; postLimit: number };
        };

        const wallet = await Wallet.findById(transaction.walletId);
        const balanceBefore = wallet
            ? wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance
            : transaction.balanceBefore;

        // Tạo UserPackage
        const userPackage = await UserPackage.create({
            userId,
            packageId,
            package: packageSnapshot,
            postedUsed: 0,
            postRemaining: packageSnapshot.postLimit,
            status: 'ACTIVE',
            purchasedAt: new Date(),
            transactionId: transaction._id,
        });

        // Cập nhật transaction
        transaction.balanceBefore = balanceBefore;
        transaction.balanceAfter = balanceBefore;
        transaction.gatewayTransactionId = gatewayTxnId;
        transaction.gatewayResponseCode = responseCode;
        transaction.data = { ...transaction.data, status: 'SUCCESS' };
        await transaction.save();

        //Noti buy userpackage
        notificationService.notifySubscriptionActivated(
            userId,
            packageSnapshot.name
        );

        if (frontendUrl) {
            res.redirect(`${frontendUrl}/packages?purchase=success&package=${packageSnapshot.code}`);
        } else {
            res.status(200).json({
                success: true,
                message: `Mua gói ${packageSnapshot.name} thành công`,
                data: { txnRef, userPackage },
            });
        }
    } catch (error: any) {
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

        //Noti cancel
        notificationService.notifySubscriptionCancelled(
            userId!.toString()
        );

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