import { z } from 'zod';

export const adminWithdrawRequestsQuerySchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED']).optional(),
    search: z.string().trim().min(1).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10)
});

export const adminWithdrawRequestIdParamSchema = z.object({
    id: z.string().min(1, 'Withdraw request id is required')
});

export const rejectWithdrawRequestSchema = z.object({
    reason: z.string()
        .trim()
        .min(1, 'Rejection reason is required')
        .max(500, 'Rejection reason cannot exceed 500 characters')
});

export const approveWithdrawRequestSchema = z.object({
    transferReference: z.string()
        .trim()
        .max(100, 'Transfer reference cannot exceed 100 characters')
        .transform(value => value === '' ? undefined : value)
        .optional()
});
