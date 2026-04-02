import { Response } from 'express';
import { AuthRequest } from '../types';
import BankAccount from '../models/BankAccount';
import User from '../models/User';
import { compareNames, normalizeBankName } from '../utils/nameUtils';
import { decryptSensitive, encryptSensitive, hashSensitive, maskSensitive } from '../utils/sensitiveData';


const MAX_BANK_ACCOUNTS = 10;

const sanitizeBankAccount = (
    bankAccount: any,
    opts?: { isAdmin?: boolean; plainAccountNumberForAdmin?: string }
): any => {
    if (!bankAccount) return bankAccount;
    const plain = typeof bankAccount.toObject === 'function' ? bankAccount.toObject() : bankAccount;

    const isAdmin = Boolean(opts?.isAdmin);
    let fullAccountNumber: string | undefined = opts?.plainAccountNumberForAdmin;

    const looksLikeHash = (value: string): boolean => {
        const v = `${value ?? ''}`.trim();
        return /^[a-f0-9]{64}$/i.test(v);
    };

    if (isAdmin && !fullAccountNumber && plain.accountNumberEncrypted) {
        try {
            fullAccountNumber = decryptSensitive(plain.accountNumberEncrypted);
        } catch (_) {
        }
    }

    if (isAdmin && !fullAccountNumber && plain.accountNumber && !looksLikeHash(plain.accountNumber)) {
        fullAccountNumber = plain.accountNumber;
    }

    if (isAdmin) {
        if (fullAccountNumber) {
            plain.accountNumber = fullAccountNumber;
        } else if (plain.accountNumberMasked) {
            plain.accountNumber = plain.accountNumberMasked;
        }
    } else {
        if (plain.accountNumberMasked) {
            plain.accountNumber = plain.accountNumberMasked;
        } else if (plain.accountNumber) {
            plain.accountNumber = maskSensitive(plain.accountNumber, 3);
        }
    }

    if (plain.accountNumberEncrypted) delete plain.accountNumberEncrypted;
    if (plain.accountNumberMasked) delete plain.accountNumberMasked;
    if (plain.bankNameNormalized) delete plain.bankNameNormalized;

    return plain;
};


/**
 * POST /api/bank-accounts - Add a bank account
 * Requires KYC verified. accountOwner must match kycFullName.
 */
export const addBankAccount = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const isAdmin = Boolean(req.user?.roles?.includes('ADMIN'));
        const userId = req.user!._id;
        const { bankName, accountNumber, accountOwner, isDefault } = req.body;

        const bankNameClean = `${bankName ?? ''}`.trim();
        const accountNumberClean = `${accountNumber ?? ''}`.trim();
        const accountOwnerClean = `${accountOwner ?? ''}`.trim();
        const bankNameNormalized = normalizeBankName(bankNameClean);
        const accountNumberHash = hashSensitive(accountNumberClean);

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
        if (!compareNames(accountOwnerClean, user.kycFullName || '')) {
            res.status(400).json({
                success: false,
                message: 'Tên chủ tài khoản phải trùng khớp với tên trên CCCD đã xác thực KYC.',
                data: {
                    kycFullName: user.kycFullName,
                    inputName: accountOwnerClean
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

        // System-wide duplicate guard (in case DB unique index isn't created yet)
        const alreadyLinked = await BankAccount.exists({
            bankNameNormalized,
            accountNumber: accountNumberHash,
        });
        if (alreadyLinked) {
            res.status(400).json({
                success: false,
                message: 'Số tài khoản ngân hàng này đã được liên kết bởi người dùng khác.'
            });
            return;
        }

        const bankAccount = await BankAccount.create({
            userId,
            bankName: bankNameClean,
            bankNameNormalized,
            accountNumber: accountNumberHash,
            accountNumberEncrypted: encryptSensitive(accountNumberClean),
            accountNumberMasked: maskSensitive(accountNumberClean, 3),
            accountOwner: accountOwnerClean,
            isDefault: shouldDefault,
            status: 'ACTIVE',
            addedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Thêm tài khoản ngân hàng thành công',
            data: sanitizeBankAccount(bankAccount, { isAdmin, plainAccountNumberForAdmin: accountNumber })
        });
    } catch (error: any) {
        // Duplicate key error
        if (error?.code === 11000) {
            const keyPattern = error?.keyPattern || {};
            const isGlobalDup = Boolean(keyPattern.bankNameNormalized && keyPattern.accountNumber);
            res.status(400).json({
                success: false,
                message: isGlobalDup
                    ? 'Số tài khoản ngân hàng này đã được liên kết bởi người dùng khác.'
                    : 'Tài khoản ngân hàng này đã được thêm trước đó.'
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
        const isAdmin = Boolean(req.user?.roles?.includes('ADMIN'));
        const userId = req.user!._id;
        const { status } = req.query;

        const filter: any = { userId };
        if (status) filter.status = status;

        const query = BankAccount.find(filter)
            .sort({ isDefault: -1, createdAt: -1 })
            .select('+accountNumber');

        if (isAdmin) {
            query.select('+accountNumberEncrypted');
        }

        const bankAccounts = await query;

        res.status(200).json({
            success: true,
            data: bankAccounts.map((b: any) => sanitizeBankAccount(b, { isAdmin }))
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
        const isAdmin = Boolean(req.user?.roles?.includes('ADMIN'));
        const userId = req.user!._id;
        const { id } = req.params;

        const query = BankAccount.findOne({ _id: id, userId }).select('+accountNumber');
        if (isAdmin) {
            query.select('+accountNumberEncrypted');
        }

        const bankAccount = await query;
        if (!bankAccount) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy tài khoản ngân hàng'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: sanitizeBankAccount(bankAccount, { isAdmin })
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
        const isAdmin = Boolean(req.user?.roles?.includes('ADMIN'));
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
            bankAccount.accountOwner = `${accountOwner ?? ''}`.trim();
        }

        if (bankName !== undefined) {
            const bankNameClean = `${bankName ?? ''}`.trim();
            (bankAccount as any).bankName = bankNameClean;
            (bankAccount as any).bankNameNormalized = normalizeBankName(bankNameClean);
        }
        if (accountNumber !== undefined) {
            const accountNumberClean = `${accountNumber ?? ''}`.trim();
            (bankAccount as any).accountNumber = hashSensitive(accountNumberClean);
            (bankAccount as any).accountNumberEncrypted = encryptSensitive(accountNumberClean);
            (bankAccount as any).accountNumberMasked = maskSensitive(accountNumberClean, 3);
        }
        if (status !== undefined) bankAccount.status = status;

        // Handle default flag
        if (isDefault === true && !bankAccount.isDefault) {
            await BankAccount.updateMany(
                { userId, _id: { $ne: bankAccount._id }, isDefault: true },
                { $set: { isDefault: false } }
            );
            bankAccount.isDefault = true;
        }

        // System-wide duplicate guard (in case DB unique index isn't created yet)
        if (bankName !== undefined || accountNumber !== undefined) {
            const nextBankNameNormalized = normalizeBankName(`${(bankAccount as any).bankName ?? ''}`);
            const nextAccountNumberHash = `${(bankAccount as any).accountNumber ?? ''}`;

            const conflict = await BankAccount.exists({
                _id: { $ne: bankAccount._id },
                bankNameNormalized: nextBankNameNormalized,
                accountNumber: nextAccountNumberHash,
            });

            if (conflict) {
                res.status(400).json({
                    success: false,
                    message: 'Số tài khoản ngân hàng này đã được liên kết bởi người dùng khác.'
                });
                return;
            }
        }

        await bankAccount.save();

        res.status(200).json({
            success: true,
            message: 'Cập nhật tài khoản ngân hàng thành công',
            data: sanitizeBankAccount(bankAccount, { isAdmin, plainAccountNumberForAdmin: accountNumber })
        });
    } catch (error: any) {
        if (error?.code === 11000) {
            const keyPattern = error?.keyPattern || {};
            const isGlobalDup = Boolean(keyPattern.bankNameNormalized && keyPattern.accountNumber);
            res.status(400).json({
                success: false,
                message: isGlobalDup
                    ? 'Số tài khoản ngân hàng này đã được liên kết bởi người dùng khác.'
                    : 'Tài khoản ngân hàng này đã tồn tại.'
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
        const isAdmin = Boolean(req.user?.roles?.includes('ADMIN'));
        const userId = req.user!._id;
        const { id } = req.params;

        const query = BankAccount.findOne({ _id: id, userId, status: 'ACTIVE' }).select('+accountNumber');
        if (isAdmin) {
            query.select('+accountNumberEncrypted');
        }

        const bankAccount = await query;
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
            data: sanitizeBankAccount(bankAccount, { isAdmin })
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Đặt tài khoản mặc định thất bại'
        });
    }
};
