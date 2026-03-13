import {z} from 'zod';

//Helper limit
const limitSchema = z.coerce
  .number() 
  .int()
  .min(1, { message: 'Limit phải từ 1' })
  .max(20, { message: 'Limit tối đa 20' })
  .default(5);

//Helper year
const yearSchema = z.coerce
  .number() 
  .int()
  .min(2000, { message: 'Năm không hợp lệ' })
  .max(new Date().getFullYear(), { message: 'Năm không hợp lệ' })
  .optional();

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
  limit: limitSchema,
  status: z
    .enum(['PENDING', 'APPROVED', 'REJECTED', 'ALL'])
    .optional()
    .default('APPROVED'), 
  year: yearSchema
});

//Top cate chart
export const topCategoriesQuerySchema = z.object({
  limit: limitSchema,
  status: z
    .enum(['PENDING', 'APPROVED', 'REJECTED', 'RESERVED', 'SOLD', 'HIDDEN', 'ALL'])
    .optional()
    .default('APPROVED'),
  year: yearSchema
});

//Top sellers chart
export const topSellersQuerySchema = z.object({
  limit: limitSchema,
  year: yearSchema
});

//Withdraw res
export const withdrawalsQuerySchema = z.object({
  year: yearSchema
});


export type WithdrawalsQueryInput = z.infer<typeof withdrawalsQuerySchema>;
export type TopSellersQueryInput = z.infer<typeof topSellersQuerySchema>;
export type TopCategoriesQueryInput = z.infer<typeof topCategoriesQuerySchema>;
export type TopBrandsQueryInput = z.infer<typeof topBrandsQuerySchema>;
export type BicyclesChartQueryInput = z.infer<typeof bicyclesChartQuerySchema>;
export type SummaryQuery = z.infer<typeof summaryQuerySchema>;