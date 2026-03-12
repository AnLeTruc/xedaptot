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

//Bicycles Chart
export const bicyclesChartQuerySchema = z.object({
      year: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val) : undefined))
        .refine(
            (val) => val === undefined || (val >= 2000 && val <= new Date().getFullYear()),
            { message: 'Năm không hợp lệ' }
        )
})

//Top brand chart
export const topBrandsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 5)) //Top 5
    .refine(
      (val) => val >= 1 && val <= 20,
      { message: 'Giới hạn phải từ 1 tới 5' }
    ),

  status: z
    .enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL'])
    .optional()
    .default('APPROVED'), 

  year: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : undefined))
    .refine(
      (val) => val === undefined || (val >= 2000 && val <= new Date().getFullYear()),
      { message: 'Năm không hợp lệ' }
    )
});

export type TopBrandsQueryInput = z.infer<typeof topBrandsQuerySchema>;
export type BicyclesChartQueryInput = z.infer<typeof bicyclesChartQuerySchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;