import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../../types';
import Transaction from '../../models/Transaction';
import User from '../../models/User';
import Wallet from '../../models/Wallet';
import WithdrawRequest from '../../models/WithdrawRequest';
import { sendWithdrawApprovedEmail, sendWithdrawRejectedEmail } from '../../services/emailService';
import { isValidateObjectId } from '../../validations/customValidation';

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
        const { transferReference } = req.body as { transferReference?: string };
        const adminId = req.user!._id;

        if (!isValidateObjectId(id)) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Invalid withdraw request id'
            });
            return;
        }

        const withdrawRequest = await WithdrawRequest.findById(id).session(session);
        if (!withdrawRequest) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Withdraw request not found'
            });
            return;
        }

        if (withdrawRequest.status !== 'PENDING') {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Only pending withdraw requests can be approved'
            });
            return;
        }

        const wallet = await Wallet.findById(withdrawRequest.walletId).session(session);
        if (!wallet) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Wallet not found'
            });
            return;
        }

        if (wallet.frozenBalance < withdrawRequest.amount) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Frozen balance is insufficient for this withdraw request'
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
                withdrawRequestId: withdrawRequest._id.toString(),
                processedAt: processedAt.toISOString(),
                processedBy: adminId.toString(),
                transferReference
            };
            transaction.paymentGateway = 'MANUAL_BANK_TRANSFER';
            transaction.gatewayTransactionId = transferReference;
            transaction.gatewayResponseCode = 'APPROVED';
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

        res.status(200).json({
            success: true,
            message: 'Withdraw request approved and completed successfully',
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
                message: 'Invalid withdraw request id'
            });
            return;
        }

        const withdrawRequest = await WithdrawRequest.findById(id).session(session);
        if (!withdrawRequest) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Withdraw request not found'
            });
            return;
        }

        if (withdrawRequest.status !== 'PENDING') {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Only pending withdraw requests can be rejected'
            });
            return;
        }

        const wallet = await Wallet.findById(withdrawRequest.walletId).session(session);
        if (!wallet) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Wallet not found'
            });
            return;
        }

        if (wallet.frozenBalance < withdrawRequest.amount) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Frozen balance is insufficient for this withdraw request'
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
                withdrawRequestId: withdrawRequest._id.toString(),
                processedAt: processedAt.toISOString(),
                processedBy: adminId.toString(),
                rejectedReason: reason
            };
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

        res.status(200).json({
            success: true,
            message: 'Withdraw request rejected successfully',
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
