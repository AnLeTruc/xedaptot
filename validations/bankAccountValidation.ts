import { z } from 'zod';


export const addBankAccountSchema = z.object({
    bankName: z.string()
        .trim()
        .min(1, 'Tên ngân hàng là bắt buộc')
        .max(100, 'Tên ngân hàng không vượt quá 100 ký tự'),
    accountNumber: z.string()
        .trim()
        .min(1, 'Số tài khoản là bắt buộc')
        .max(30, 'Số tài khoản không vượt quá 30 ký tự')
        .regex(/^[0-9]+$/, 'Số tài khoản chỉ chứa ký tự số'),
    accountOwner: z.string()
        .trim()
        .min(1, 'Tên chủ tài khoản là bắt buộc')
        .max(100, 'Tên chủ tài khoản không vượt quá 100 ký tự'),
    isDefault: z.boolean().optional().default(false)
});


export const updateBankAccountSchema = z.object({
    bankName: z.string()
        .trim()
        .min(1, 'Tên ngân hàng là bắt buộc')
        .max(100, 'Tên ngân hàng không vượt quá 100 ký tự')
        .optional(),
    accountNumber: z.string()
        .trim()
        .min(1, 'Số tài khoản là bắt buộc')
        .max(30, 'Số tài khoản không vượt quá 30 ký tự')
        .regex(/^[0-9]+$/, 'Số tài khoản chỉ chứa ký tự số')
        .optional(),
    accountOwner: z.string()
        .trim()
        .min(1, 'Tên chủ tài khoản là bắt buộc')
        .max(100, 'Tên chủ tài khoản không vượt quá 100 ký tự')
        .optional(),
    isDefault: z.boolean().optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional()
});
