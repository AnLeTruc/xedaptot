import { z } from "zod";

export const createBrandSchema = z.object({
    name: z.string()
        .min(1, 'Brand name is required')
        .max(100, 'Country cannot exceed 100 characters'),
    country: z.string()
        .max(100, 'Country cannot exceed 100 characters')
        .optional(),
});



export const updateBrandSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    country: z.string().max(100).optional(),
    imageUrl: z.string().url('imageUrl must be a valid URL').optional(),
    isActive: z.boolean().optional()
});



export const brandIdParamSchema = z.object({
    id: z.string()
        .min(1, 'Brand ID is required')
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid brand ID format')
});


export const getBrandsQuerySchema = z.object({
    page: z.string()
        .regex(/^\d+$/, 'Page must be a positive number')
        .optional()
        .transform(val => val ? parseInt(val, 10) : 1),
    limit: z.string()
        .regex(/^\d+$/, 'Limit must be a positive number')
        .optional()
        .transform(val => val ? parseInt(val, 10) : 10),
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().optional()
});


export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type BrandIdParam = z.infer<typeof brandIdParamSchema>;
export type GetBrandsQuery = z.infer<typeof getBrandsQuerySchema>;