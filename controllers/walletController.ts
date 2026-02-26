import { Response } from 'express';
import { AuthRequest } from '../types';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import WithdrawRequest from '../models/WithdrawRequest';
import mongoose from 'mongoose';


//Get or create wallet for any user
export const getOrCreateWallet = async (userId: mongoose.Types.ObjectId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId });
    }
    return wallet;
};

const generateCode = (prefix: string) => {
    const d = new Date().toISOString().replace(/-/g, '');
    return `${prefix}-${d}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
};


// GET /wallets/me - Get my wallet
export const getMyWallet = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const wallet = await getOrCreateWallet(userId);

        res.status(200).json({
            success: true,
            data: wallet
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// GET /wallets/transactions - Get transaction history
export const getTransactions = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { type, page = '1', limit = '10' } = req.query;

        const wallet = await getOrCreateWallet(userId);

        const filter: any = { walletId: wallet._id };
        if (type) filter.type = type;

        const pageNum = Math.max(1, +page);
        const limitNum = Math.min(50, Math.max(1, +limit));

        const [transactions, total] = await Promise.all([
            Transaction.find(filter)
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
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * POST /wallets/deposit - Deposit money to wallet
 */
export const depositToWallet = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { amount } = req.body;

        const wallet = await getOrCreateWallet(userId);

        // --- MOCK DEPOSIT (replace with VNPay when integrating) ---
        const balanceBefore = wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance;
        wallet.totalEarn += amount;
        wallet.totalReceived += amount;
        await wallet.save();

        await Transaction.create({
            transactionCode: generateCode('DEP'),
            paymentMethod: 'MOCK',    // change to 'VNPAY' when integrating
            walletId: wallet._id,
            type: 'DEPOSIT',
            amount,
            balanceBefore,
            balanceAfter: balanceBefore + amount,
            description: `Deposit to wallet (mock)`,
            paymentGateway: 'MOCK',   // change to 'VNPAY'
        });
        // --- END MOCK ---

        res.status(201).json({
            success: true,
            message: 'Deposit successful',
            data: {
                wallet: await getOrCreateWallet(userId),
                depositAmount: amount
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


// POST /wallets/withdraw - Create withdraw request
export const createWithdrawRequest = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const userId = req.user!._id;
        const { amount, bankInfo } = req.body;

        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Wallet not found. Please contact support.'
            });
            return;
        }

        // Check available balance
        const availableBalance = wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance;
        if (amount > availableBalance) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Insufficient available balance',
                data: { availableBalance, requested: amount }
            });
            return;
        }

        // Check if there's a pending withdraw request
        const pendingRequest = await WithdrawRequest.findOne({
            userId,
            status: 'PENDING'
        }).session(session);

        if (pendingRequest) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'You already have a pending withdraw request'
            });
            return;
        }

        // Freeze the amount
        wallet.frozenBalance += amount;
        await wallet.save({ session });

        // Create withdraw request
        const [withdrawRequest] = await WithdrawRequest.create([{
            userId,
            walletId: wallet._id,
            amount,
            bankInfo,
            status: 'PENDING'
        }], { session });

        // Create transaction record
        const balanceBefore = availableBalance;
        const balanceAfter = balanceBefore - amount;
        await Transaction.create([{
            transactionCode: generateCode('WDR'),
            paymentMethod: 'BANK_TRANSFER',
            walletId: wallet._id,
            type: 'WITHDRAW',
            amount,
            balanceBefore,
            balanceAfter,
            description: `Withdraw request - ${bankInfo.bankName} - ${bankInfo.accountNumber}`
        }], { session });

        await session.commitTransaction();

        res.status(201).json({
            success: true,
            message: 'Withdraw request created, pending admin approval',
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


// GET /wallets/withdraw-requests - Get my withdraw requests
export const getWithdrawRequests = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { status, page = '1', limit = '10' } = req.query;

        const filter: any = { userId };
        if (status) filter.status = status;

        const pageNum = Math.max(1, +page);
        const limitNum = Math.min(50, Math.max(1, +limit));

        const [requests, total] = await Promise.all([
            WithdrawRequest.find(filter)
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
