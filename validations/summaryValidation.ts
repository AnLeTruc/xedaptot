import {z} from 'zod';

export const summaryQuerySchema  = z.object({
    period: z
        .enum([ 'quarter', 'week', 'month', 'year', 'all' ])
        .optional()
        .default('all'),

    year: z
        .string()
        .optional()
        .transform( (val) => (val ? parseInt(val) : undefined))
        .refine(
            (val) => val === undefined || (val >= 2000 && val <= new Date().getFullYear()),
            {message: 'Năm phải từ 2000 đến năm hiện tại'}
        )
});

export type SummaryQuery = z.infer<typeof summaryQuerySchema>;