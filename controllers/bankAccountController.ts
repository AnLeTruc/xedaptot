import { Response } from 'express';
import { AuthRequest } from '../types';
import BankAccount from '../models/BankAccount';
import User from '../models/User';
import { compareNames } from '../utils/nameUtils';


const MAX_BANK_ACCOUNTS = 10;


/**
 * POST /api/bank-accounts - Add a bank account
 * Requires KYC verified. accountOwner must match kycFullName.
 */
export const addBankAccount = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { bankName, accountNumber, accountOwner, isDefault } = req.body;

        // Check KYC status
        const user = await User.findById(userId);
        if (!user || user.kycStatus !== 'VERIFIED') {
            res.status(400).json({
                success: false,
                message: 'Vui lòng xác thực CCCD (KYC) trước khi thêm tài khoản ngân hàng.'
            });
            return;
        }

        // Compare accountOwner with KYC name
        if (!compareNames(accountOwner, user.kycFullName || '')) {
            res.status(400).json({
                success: false,
                message: 'Tên chủ tài khoản phải trùng khớp với tên trên CCCD đã xác thực KYC.',
                data: {
                    kycFullName: user.kycFullName,
                    inputName: accountOwner
                }
            });
            return;
        }

        // Check max bank accounts
        const count = await BankAccount.countDocuments({ userId, status: 'ACTIVE' });
        if (count >= MAX_BANK_ACCOUNTS) {
            res.status(400).json({
                success: false,
                message: `Bạn chỉ có thể thêm tối đa ${MAX_BANK_ACCOUNTS} tài khoản ngân hàng.`
            });
            return;
        }

        // If isDefault and it's the first account, auto set default
        const shouldDefault = isDefault || count === 0;

        // If setting as default, unset others
        if (shouldDefault) {
            await BankAccount.updateMany(
                { userId, isDefault: true },
                { $set: { isDefault: false } }
            );
        }

        const bankAccount = await BankAccount.create({
            userId,
            bankName,
            accountNumber,
            accountOwner,
            isDefault: shouldDefault,
            status: 'ACTIVE',
            addedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Thêm tài khoản ngân hàng thành công',
            data: bankAccount
        });
    } catch (error: any) {
        // Duplicate key error
        if (error?.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Tài khoản ngân hàng này đã được thêm trước đó.'
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Thêm tài khoản ngân hàng thất bại'
        });
    }
};


/**
 * GET /api/bank-accounts - Get all bank accounts of current user
 */
export const getBankAccounts = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { status } = req.query;

        const filter: any = { userId };
        if (status) filter.status = status;

        const bankAccounts = await BankAccount.find(filter)
            .sort({ isDefault: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            data: bankAccounts
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Lấy danh sách tài khoản ngân hàng thất bại'
        });
    }
};


/**
 * GET /api/bank-accounts/:id - Get a single bank account
 */
export const getBankAccountById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { id } = req.params;

        const bankAccount = await BankAccount.findOne({ _id: id, userId });
        if (!bankAccount) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản ngân hàng'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: bankAccount
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Lấy tài khoản ngân hàng thất bại'
        });
    }
};


/**
 * PUT /api/bank-accounts/:id - Update a bank account
 * Only allows updating bankName, accountNumber, isDefault, status.
 * If accountOwner changes, must re-validate against KYC.
 */
export const updateBankAccount = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { id } = req.params;
        const { bankName, accountNumber, accountOwner, isDefault, status } = req.body;

        const bankAccount = await BankAccount.findOne({ _id: id, userId });
        if (!bankAccount) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản ngân hàng'
            });
            return;
        }

        // If accountOwner is being changed, validate against KYC
        if (accountOwner && accountOwner !== bankAccount.accountOwner) {
            const user = await User.findById(userId);
            if (!user || user.kycStatus !== 'VERIFIED') {
                res.status(400).json({
                    success: false,
                    message: 'Vui lòng xác thực CCCD (KYC) trước.'
                });
                return;
            }

            if (!compareNames(accountOwner, user.kycFullName || '')) {
                res.status(400).json({
                    success: false,
                    message: 'Tên chủ tài khoản phải trùng khớp với tên trên CCCD đã xác thực KYC.',
                    data: {
                        kycFullName: user.kycFullName,
                        inputName: accountOwner
                    }
                });
                return;
            }
            bankAccount.accountOwner = accountOwner;
        }

        if (bankName !== undefined) bankAccount.bankName = bankName;
        if (accountNumber !== undefined) bankAccount.accountNumber = accountNumber;
        if (status !== undefined) bankAccount.status = status;

        // Handle default flag
        if (isDefault === true && !bankAccount.isDefault) {
            await BankAccount.updateMany(
                { userId, _id: { $ne: bankAccount._id }, isDefault: true },
                { $set: { isDefault: false } }
            );
            bankAccount.isDefault = true;
        }

        await bankAccount.save();

        res.status(200).json({
            success: true,
            message: 'Cập nhật tài khoản ngân hàng thành công',
            data: bankAccount
        });
    } catch (error: any) {
        if (error?.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Tài khoản ngân hàng này đã tồn tại.'
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error.message || 'Cập nhật tài khoản ngân hàng thất bại'
        });
    }
};


/**
 * DELETE /api/bank-accounts/:id - Soft delete (set status = INACTIVE)
 */
export const deleteBankAccount = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { id } = req.params;

        const bankAccount = await BankAccount.findOne({ _id: id, userId });
        if (!bankAccount) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản ngân hàng'
            });
            return;
        }

        bankAccount.status = 'INACTIVE';
        bankAccount.isDefault = false;
        await bankAccount.save();

        // If deleted account was default, set the first active one as default
        const firstActive = await BankAccount.findOne({ userId, status: 'ACTIVE' })
            .sort({ createdAt: 1 });
        if (firstActive && !(await BankAccount.exists({ userId, status: 'ACTIVE', isDefault: true }))) {
            firstActive.isDefault = true;
            await firstActive.save();
        }

        res.status(200).json({
            success: true,
            message: 'Xoá tài khoản ngân hàng thành công'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Xoá tài khoản ngân hàng thất bại'
        });
    }
};


/**
 * PUT /api/bank-accounts/:id/default - Set as default bank account
 */
export const setDefaultBankAccount = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;
        const { id } = req.params;

        const bankAccount = await BankAccount.findOne({ _id: id, userId, status: 'ACTIVE' });
        if (!bankAccount) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản ngân hàng hoặc tài khoản đã bị vô hiệu hoá'
            });
            return;
        }

        // Unset all defaults
        await BankAccount.updateMany(
            { userId, isDefault: true },
            { $set: { isDefault: false } }
        );

        // Set this one as default
        bankAccount.isDefault = true;
        await bankAccount.save();

        res.status(200).json({
            success: true,
            message: 'Đặt tài khoản ngân hàng mặc định thành công',
            data: bankAccount
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Đặt tài khoản mặc định thất bại'
        });
    }
};
