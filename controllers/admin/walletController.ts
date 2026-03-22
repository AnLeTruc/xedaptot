import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../types';
import Transaction from '../../models/Transaction';
import User from '../../models/User';
import Wallet from '../../models/Wallet';
import WithdrawRequest from '../../models/WithdrawRequest';
import { sendWithdrawApprovedEmail, sendWithdrawRejectedEmail } from '../../services/emailService';
import { isValidateObjectId } from '../../validations/customValidation';

import * as notificationService from '../../services/notificationService';

const getWithdrawTransaction = async (
    walletId: mongoose.Types.ObjectId,
    withdrawRequestId: string,
    session: mongoose.ClientSession
) => {
    return Transaction.findOne({
        walletId,
        type: 'WITHDRAW',
        'data.withdrawRequestId': withdrawRequestId
    }).session(session);
};

export const getWithdrawRequestsAdmin = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { status, search, page = 1, limit = 10 } = req.query as {
            status?: string;
            search?: string;
            page?: number;
            limit?: number;
        };

        const filter: any = {};
        if (status) {
            filter.status = status;
        }

        if (search) {
            const matchedUsers = await User.find({
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { fullName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');

            if (matchedUsers.length === 0) {
                res.status(200).json({
                    success: true,
                    data: {
                        withdrawRequests: [],
                        pagination: {
                            page: Math.max(1, Number(page)),
                            limit: Math.min(50, Math.max(1, Number(limit))),
                            total: 0,
                            totalPages: 0
                        }
                    }
                });
                return;
            }

            filter.userId = { $in: matchedUsers.map(user => user._id) };
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(50, Math.max(1, Number(limit)));

        const [requests, total] = await Promise.all([
            WithdrawRequest.find(filter)
                .populate('userId', 'fullName email phone')
                .populate('processedBy', 'fullName email')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            WithdrawRequest.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: {
                withdrawRequests: requests,
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

export const approveWithdrawRequest = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;

        if (!isValidateObjectId(id)) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Mã yêu cầu rút tiền không hợp lệ'
            });
            return;
        }

        const withdrawRequest = await WithdrawRequest.findById(id).session(session);
        if (!withdrawRequest) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu rút tiền'
            });
            return;
        }

        if (withdrawRequest.status !== 'PENDING') {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Chỉ có thể duyệt yêu cầu rút tiền đang chờ'
            });
            return;
        }

        withdrawRequest.status = 'APPROVED';
        withdrawRequest.processedBy = req.user!._id;
        withdrawRequest.rejectedReason = undefined;
        withdrawRequest.transferReference = undefined;
        await withdrawRequest.save({ session });

        const transaction = await getWithdrawTransaction(
            withdrawRequest.walletId as mongoose.Types.ObjectId,
            withdrawRequest._id.toString(),
            session
        );

        if (transaction) {
            transaction.data = {
                ...(transaction.data || {}),
                withdrawRequestId: withdrawRequest._id.toString(),
                status: 'PENDING',
                approvalStatus: 'APPROVED'
            };
            transaction.gatewayResponseCode = 'APPROVED';
            await transaction.save({ session });
        }

        await session.commitTransaction();

        res.status(200).json({
            success: true,
            message: 'Duyệt yêu cầu rút tiền thành công',
            data: withdrawRequest
        });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
};

export const completeWithdrawRequest = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { transferReference } = req.body as { transferReference?: string };
        const adminId = req.user!._id;

        if (!isValidateObjectId(id)) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Mã yêu cầu rút tiền không hợp lệ'
            });
            return;
        }

        const withdrawRequest = await WithdrawRequest.findById(id).session(session);
        if (!withdrawRequest) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu rút tiền'
            });
            return;
        }

        if (withdrawRequest.status !== 'APPROVED') {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Chỉ có thể hoàn thành yêu cầu rút tiền đã được duyệt'
            });
            return;
        }

        const wallet = await Wallet.findById(withdrawRequest.walletId).session(session);
        if (!wallet) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy ví'
            });
            return;
        }

        if (wallet.frozenBalance < withdrawRequest.amount) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Số dư đóng băng không đủ cho yêu cầu rút tiền này'
            });
            return;
        }

        const processedAt = new Date();
        wallet.frozenBalance -= withdrawRequest.amount;
        wallet.totalWithdrawn += withdrawRequest.amount;
        await wallet.save({ session });

        withdrawRequest.status = 'COMPLETED';
        withdrawRequest.processedAt = processedAt;
        withdrawRequest.processedBy = adminId;
        withdrawRequest.rejectedReason = undefined;
        withdrawRequest.transferReference = transferReference;
        await withdrawRequest.save({ session });

        const transaction = await getWithdrawTransaction(
            withdrawRequest.walletId as mongoose.Types.ObjectId,
            withdrawRequest._id.toString(),
            session
        );

        if (transaction) {
            transaction.data = {
                ...(transaction.data || {}),
                status: 'SUCCESS',
                approvalStatus: 'APPROVED',
                withdrawRequestId: withdrawRequest._id.toString(),
                processedAt: processedAt.toISOString(),
                processedBy: adminId.toString(),
                transferReference
            };
            transaction.paymentGateway = 'MANUAL_BANK_TRANSFER';
            transaction.gatewayTransactionId = transferReference;
            transaction.gatewayResponseCode = 'COMPLETED';
            await transaction.save({ session });
        }

        await session.commitTransaction();

        const user = await User.findById(withdrawRequest.userId)
            .select('email fullName');

        if (user?.email) {
            await sendWithdrawApprovedEmail(user.email, user.fullName || '', {
                requestId: withdrawRequest._id.toString(),
                amount: withdrawRequest.amount,
                bankInfo: withdrawRequest.bankInfo,
                requestedAt: withdrawRequest.createdAt,
                processedAt,
                transferReference
            });
        }

        //Noti withdraw approved
        notificationService.notifyWithdrawApproved(
            withdrawRequest.userId.toString()
        );
        res.status(200).json({
            success: true,
            message: 'Hoàn thành yêu cầu rút tiền thành công',
            data: withdrawRequest
        });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
};



export const getAllTransactionsAdmin = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { type, walletId, orderId, search, page = 1, limit = 10 } = req.query as {
            type?: string;
            walletId?: string;
            orderId?: string;
            search?: string;
            page?: number;
            limit?: number;
        };

        const filter: any = {};
        if (type) {
            filter.type = type;
        }
        if (walletId) {
            filter.walletId = walletId;
        }
        if (orderId) {
            filter.orderId = orderId;
        }
        // Vì Transaction không lưu trực tiếp user info,
        // mà lưu walletId → phải tìm ngược: User → Wallet → Transaction
        if (search) {
            const matchedUsers = await User.find({
                $or: [
                    { email: { $regex: search, $options: 'i' } },
                    { fullName: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            if (matchedUsers.length === 0) {
                res.status(200).json({
                    success: true,
                    data: {
                        transactions: [],
                        pagination: { page: Number(page), limit: Number(limit) }
                    }
                });
                return;
            }

            const walletIds = await Wallet.find({
                userId: { $in: matchedUsers.map(user => user._id) }
            }).select('_id');

            filter.walletId = { $in: walletIds.map(wallet => wallet._id) };
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(50, Math.max(1, Number(limit)));
        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
                .populate({
                    path: 'walletId',
                    select: 'userId',
                    populate: { path: 'userId', select: 'fullName email phone' }
                })
                .populate('orderId', 'orderCode status')
                .sort({ createdAt: -1 })
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum),
            Transaction.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: {
                transactions,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum)
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};




export const rejectWithdrawRequest = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { id } = req.params;
        const { reason } = req.body;
        const adminId = req.user!._id;

        if (!isValidateObjectId(id)) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Mã yêu cầu rút tiền không hợp lệ'
            });
            return;
        }

        const withdrawRequest = await WithdrawRequest.findById(id).session(session);
        if (!withdrawRequest) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy yêu cầu rút tiền'
            });
            return;
        }

        if (!['PENDING', 'APPROVED'].includes(withdrawRequest.status)) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Chỉ có thể từ chối yêu cầu rút tiền đang chờ hoặc đã duyệt'
            });
            return;
        }

        const previousStatus = withdrawRequest.status;

        const wallet = await Wallet.findById(withdrawRequest.walletId).session(session);
        if (!wallet) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy ví'
            });
            return;
        }

        if (wallet.frozenBalance < withdrawRequest.amount) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Số dư đóng băng không đủ cho yêu cầu rút tiền này'
            });
            return;
        }

        const processedAt = new Date();
        wallet.frozenBalance -= withdrawRequest.amount;
        await wallet.save({ session });

        withdrawRequest.status = 'REJECTED';
        withdrawRequest.rejectedReason = reason;
        withdrawRequest.processedAt = processedAt;
        withdrawRequest.processedBy = adminId;
        withdrawRequest.transferReference = undefined;
        await withdrawRequest.save({ session });

        const transaction = await getWithdrawTransaction(
            withdrawRequest.walletId as mongoose.Types.ObjectId,
            withdrawRequest._id.toString(),
            session
        );

        if (transaction) {
            transaction.balanceAfter = transaction.balanceBefore;
            transaction.data = {
                ...(transaction.data || {}),
                status: 'FAILED',
                approvalStatus: previousStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
                withdrawRequestId: withdrawRequest._id.toString(),
                processedAt: processedAt.toISOString(),
                processedBy: adminId.toString(),
                rejectedReason: reason
            };
            transaction.gatewayTransactionId = undefined;
            transaction.gatewayResponseCode = 'REJECTED';
            await transaction.save({ session });
        }

        await session.commitTransaction();

        const user = await User.findById(withdrawRequest.userId)
            .select('email fullName');

        if (user?.email) {
            await sendWithdrawRejectedEmail(user.email, user.fullName || '', {
                requestId: withdrawRequest._id.toString(),
                amount: withdrawRequest.amount,
                bankInfo: withdrawRequest.bankInfo,
                requestedAt: withdrawRequest.createdAt,
                processedAt,
                reason
            });
        }

        notificationService.notifyWithdrawRejected(
            withdrawRequest.userId.toString(),
            reason || 'Không có lý do cụ thể'
        );
        res.status(200).json({
            success: true,
            message: 'Từ chối yêu cầu rút tiền thành công',
            data: withdrawRequest
        });
    } catch (error: any) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            message: error.message
        });
    } finally {
        session.endSession();
    }
};
