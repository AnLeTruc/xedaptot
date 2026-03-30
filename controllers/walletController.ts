import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import WithdrawRequest from '../models/WithdrawRequest';
import mongoose from 'mongoose';
import * as notificationService from '../services/notificationService';
import { createPaymentUrl, verifyReturnUrl, getResponseMessage } from '../services/vnpayService';
import { VietQRService } from '../services/vietqrService';

//Get or create wallet for any user
export const getOrCreateWallet = async (userId: mongoose.Types.ObjectId) => {
    try {
        const wallet = await Wallet.findOneAndUpdate(
            { userId },
            { $setOnInsert: { userId } },
            {
                new: true,
                upsert: true,
                setDefaultsOnInsert: true
            }
        );

        return wallet;
    } catch (error: any) {
        if (error?.code === 11000) {
            const existingWallet = await Wallet.findOne({ userId });
            if (existingWallet) {
                return existingWallet;
            }
        }

        throw error;
    }
};

const generateCode = (prefix: string) => {
    const d = new Date().toISOString().replace(/[-T:.Z]/g, ''); // Remove all special chars
    return `${prefix}-${d}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
};

const MAX_PENDING_WITHDRAW_REQUESTS = 3;
const WITHDRAW_AUTO_THRESHOLD = 3000000;
const AUTO_TRANSFER_DELAY_MS = 30000;

const checkWithdrawalStrategy = (amount: number, user: AuthRequest['user']) => {
    const isTrusted = user?.isTrusted === true;
    const isNewUser = user?.isNewUser === true;
    const isAuto = amount <= WITHDRAW_AUTO_THRESHOLD && isTrusted;

    if (isAuto) {
        return {
            status: 'COMPLETED' as const,
            type: 'AUTO' as const,
            isAuto: true,
            message: 'Tiền đã được chuyển về tài khoản Ngân Hàng của bạn'
        };
    }

    if (amount > WITHDRAW_AUTO_THRESHOLD || isNewUser) {
        return {
            status: 'PENDING' as const,
            type: 'MANUAL' as const,
            isAuto: false,
            message: 'Yêu cầu rút tiền đã tạo, đang chờ admin duyệt'
        };
    }

    return {
        status: 'PENDING' as const,
        type: 'MANUAL' as const,
        isAuto: false,
        message: 'Yêu cầu rút tiền đã tạo, đang chờ admin duyệt'
    };
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
            message: 'Tải ví thất bại. Vui lòng thử lại sau.'
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
            message: 'Tải lịch sử giao dịch ví thất bại. Vui lòng thử lại sau.'
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
        const { amount, bankCode } = req.body;
        //           ^^^^^^^^ thêm bankCode (optional, user có thể chọn trước ngân hàng)

        const wallet = await getOrCreateWallet(userId);

        // Tạo mã giao dịch nội bộ — dùng để MAP khi VNPay callback về
        const txnRef = generateCode('DEP');

        await Transaction.create({
            transactionCode: txnRef,          // Internal ref code for mapping
            paymentMethod: 'VNPAY',
            walletId: wallet._id,
            type: 'DEPOSIT',
            amount,
            balanceBefore: wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance,
            balanceAfter: 0,                  // Unknown yet, will update on callback
            description: `Deposit ${amount.toLocaleString()} VND to wallet via VNPay`,
            paymentGateway: 'VNPAY',
            gatewayTransactionId: '',         // Not available yet, VNPay will provide
            gatewayResponseCode: '',          // Not available yet
            data: { status: 'PENDING', userId: userId.toString() },
        });

        let ipAddr = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || '127.0.0.1';
        // VNPay doesn't accept IPv6 — convert ::1 and ::ffff:x.x.x.x to IPv4
        if (ipAddr === '::1') ipAddr = '127.0.0.1';
        if (ipAddr.startsWith('::ffff:')) ipAddr = ipAddr.substring(7);
        // Gọi VNPay service tạo URL
        const paymentUrl = createPaymentUrl({
            amount,
            orderId: txnRef,                     // Gửi mã nội bộ cho VNPay
            orderInfo: `Deposit+${txnRef}`,
            ipAddr,
            bankCode,                            // Optional
        });

        // Trả URL cho frontend — KHÔNG cộng tiền ở đây!
        res.status(200).json({
            success: true,
            message: 'Chuyển hướng người dùng đến paymentUrl để hoàn tất nạp tiền',
            data: { paymentUrl, txnRef }
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Khởi tạo nạp tiền ví thất bại. Vui lòng thử lại sau.'
        });
    }
};



// GET /api/wallets/vnpay-return
export const vnpayReturn = async (
    req: Request,       // ← Request thường, KHÔNG phải AuthRequest (không có JWT)
    res: Response
): Promise<void> => {
    try {
        const vnpParams = req.query as Record<string, string>;
        // req.query chứa tất cả params VNPay gửi về qua URL
        const isValid = verifyReturnUrl(vnpParams);
        if (!isValid) {
            // Chữ ký sai → có thể bị giả mạo → REJECT
            res.status(400).json({
                success: false,
                message: 'Chữ ký VNPay không hợp lệ'
            });
            return;
        }
        const txnRef = vnpParams['vnp_TxnRef'];           // Mã giao dịch CỦA MÌNH
        const responseCode = vnpParams['vnp_ResponseCode']; // '00' = OK, khác = fail
        const vnpAmount = parseInt(vnpParams['vnp_Amount']) / 100;  // Chia 100 lại
        const gatewayTxnId = vnpParams['vnp_TransactionNo'] || '';  // Mã giao dịch VNPay cấp

        const transaction = await Transaction.findOne({
            transactionCode: txnRef,     // Map theo mã nội bộ
            type: 'DEPOSIT',
            'data.status': 'PENDING',    // Chỉ tìm PENDING (chưa xử lý)
        });

        if (!transaction) {
            // Không tìm thấy HOẶC đã xử lý rồi (duplicate callback)
            res.status(404).json({ success: false, message: 'Giao dịch không tìm thấy hoặc đã được xử lý' });
            return;
        }


        if (responseCode !== '00') {
            transaction.data = { ...transaction.data, status: 'FAILED' };
            transaction.gatewayResponseCode = responseCode;
            transaction.gatewayTransactionId = gatewayTxnId;
            await transaction.save();
            // Không cộng tiền! Chỉ update transaction → FAILED

            notificationService.notifyWalletTopUpFailed(
                transaction.data.userId
            );
            res.status(400).json({
                success: false,
                message: getResponseMessage(responseCode),
                data: { txnRef, responseCode }
            });
            return;
        }
        const wallet = await Wallet.findById(transaction.walletId);
        if (!wallet) {
            res.status(404).json({ success: false, message: 'Không tìm thấy ví' });
            return;
        }

        const balanceBefore = wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance;

        // ⭐ CỘNG TIỀN VÀO WALLET
        wallet.totalEarn += vnpAmount;      // Tổng tiền kiếm được tăng
        wallet.totalReceived += vnpAmount;  // Tổng tiền nạp tăng
        await wallet.save();
        // availableBalance (virtual) = totalEarn - totalWithdrawn - frozenBalance
        // → Tự động tăng lên vnpAmount
        transaction.balanceBefore = balanceBefore;
        transaction.balanceAfter = balanceBefore + vnpAmount;
        transaction.gatewayTransactionId = gatewayTxnId;
        transaction.gatewayResponseCode = responseCode;
        transaction.data = { ...transaction.data, status: 'SUCCESS' };
        await transaction.save();

        notificationService.notifyWalletTopUpSuccess(
            transaction.data.userId
        );

        const frontendUrl = process.env.FRONTEND_URL;
        if (frontendUrl) {
            // Nếu có frontend → redirect user về trang wallet
            res.redirect(`${frontendUrl}/wallet?deposit=success&amount=${vnpAmount}`);
        } else {
            // Không có frontend → trả JSON (test bằng browser/Postman)
            res.status(200).json({
                success: true,
                message: `Nạp ${vnpAmount.toLocaleString()}đ thành công`,
                data: { txnRef, amount: vnpAmount }
            });
        }
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};




export const vnpayIPN = async (req: Request, res: Response): Promise<void> => {
    try {
        const vnpParams = req.query as Record<string, string>;

        // Verify
        if (!verifyReturnUrl(vnpParams)) {
            res.status(200).json({ RspCode: '97', Message: 'Invalid checksum' });
            return;
        }

        const txnRef = vnpParams['vnp_TxnRef'];
        const responseCode = vnpParams['vnp_ResponseCode'];
        const vnpAmount = parseInt(vnpParams['vnp_Amount']) / 100;
        const gatewayTxnId = vnpParams['vnp_TransactionNo'] || '';

        const transaction = await Transaction.findOne({ transactionCode: txnRef, type: 'DEPOSIT' });

        if (!transaction) {
            res.status(200).json({ RspCode: '01', Message: 'Không tìm thấy đơn hàng' });
            return;
        }

        // Đã xử lý rồi → skip
        if (transaction.data?.status === 'SUCCESS' || transaction.data?.status === 'FAILED') {
            res.status(200).json({ RspCode: '02', Message: 'Order already processed' });
            return;
        }

        // Check số tiền khớp
        if (transaction.amount !== vnpAmount) {
            res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
            return;
        }

        // Thanh toán fail
        if (responseCode !== '00') {
            transaction.data = { ...transaction.data, status: 'FAILED' };
            transaction.gatewayResponseCode = responseCode;
            transaction.gatewayTransactionId = gatewayTxnId;
            await transaction.save();

            notificationService.notifyWalletTopUpFailed(
                transaction.data.userId
            );
            res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
            return;
        }

        // Thanh toán OK → cộng tiền (giống vnpayReturn)
        const wallet = await Wallet.findById(transaction.walletId);
        if (!wallet) {
            res.status(200).json({ RspCode: '01', Message: 'Không tìm thấy ví' });
            return;
        }

        const balanceBefore = wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance;
        wallet.totalEarn += vnpAmount;
        wallet.totalReceived += vnpAmount;
        await wallet.save();

        transaction.balanceBefore = balanceBefore;
        transaction.balanceAfter = balanceBefore + vnpAmount;
        transaction.gatewayTransactionId = gatewayTxnId;
        transaction.gatewayResponseCode = responseCode;
        transaction.data = { ...transaction.data, status: 'SUCCESS' };
        await transaction.save();

        notificationService.notifyWalletTopUpSuccess(
            transaction.data.userId
        );

        res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } catch (error: any) {
        res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
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
        const user = req.user;

        if (!user || user.kycStatus !== 'VERIFIED') {
            await session.abortTransaction();
            res.status(403).json({
                success: false,
                message: 'Vui lòng xác thực CCCD trước khi rút tiền.'
            });
            return;
        }

        const wallet = await Wallet.findOne({ userId }).session(session);
        if (!wallet) {
            await session.abortTransaction();
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy ví. Vui lòng liên hệ hỗ trợ.'
            });
            return;
        }

        // Check available balance
        const availableBalance = wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance;
        if (amount > availableBalance) {
            await session.abortTransaction();
            res.status(400).json({
                success: false,
                message: 'Số dư không đủ',
                data: { availableBalance, requested: amount }
            });
            return;
        }

        const strategy = checkWithdrawalStrategy(amount, user);

        if (!strategy.isAuto) {
            // Allow a user to keep at most 3 pending withdraw requests at a time
            const pendingRequestCount = await WithdrawRequest.countDocuments({
                userId,
                status: 'PENDING'
            }).session(session);

            if (pendingRequestCount >= MAX_PENDING_WITHDRAW_REQUESTS) {
                await session.abortTransaction();
                res.status(400).json({
                    success: false,
                    message: `You can only have up to ${MAX_PENDING_WITHDRAW_REQUESTS} pending withdraw requests`,
                    data: {
                        pendingRequestCount,
                        maxPendingRequests: MAX_PENDING_WITHDRAW_REQUESTS
                    }
                });
                return;
            }
        }

        const balanceBefore = availableBalance;
        const balanceAfter = balanceBefore - amount;

        if (strategy.isAuto) {
            wallet.totalWithdrawn += amount;
        } else {
            wallet.frozenBalance += amount;
        }
        await wallet.save({ session });

        const [withdrawRequest] = await WithdrawRequest.create([{
            userId,
            walletId: wallet._id,
            amount,
            bankInfo,
            status: strategy.status,
            type: strategy.type,
            processedAt: strategy.isAuto ? new Date() : undefined
        }], { session });

        await Transaction.create([{
            transactionCode: generateCode('WDR'),
            paymentMethod: 'BANK_TRANSFER',
            data: {
                status: strategy.isAuto ? 'SUCCESS' : 'PENDING',
                withdrawRequestId: withdrawRequest._id.toString(),
                strategy: strategy.type
            },
            walletId: wallet._id,
            type: 'WITHDRAW',
            amount,
            balanceBefore,
            balanceAfter,
            description: `Withdraw request - ${bankInfo.bankName} - ${bankInfo.accountNumber}`
        }], { session });

        await session.commitTransaction();

        if (strategy.isAuto) {
            setTimeout(() => {
                notificationService.notifyWithdrawApproved(userId.toString());
            }, AUTO_TRANSFER_DELAY_MS);
        } else {
            notificationService.notifyWithdrawRequested(userId.toString());
            notificationService.notifyAdminWithdrawRequest(
                req.user!.fullName || req.user!.email,
                amount
            );
        }

        res.status(201).json({
            success: true,
            message: strategy.message,
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


// GET /wallets/banks
export const getBanks = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const banks = await VietQRService.getBanksList();

        res.status(200).json({
            success: true,
            message: 'Lấy danh sách ngân hàng thành công',
            data: banks
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi hệ thống khi tải dữ liệu ngân hàng'
        });
    }
};
