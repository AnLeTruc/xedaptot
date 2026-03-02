import { z } from 'zod';

export const createBicycleModelSchema = z.object({
    name: z.string()
        .min(1, 'Model name is required')
        .max(200, 'Model name cannot exceed 200 characters'),
    brandId: z.string()
        .min(1, 'Brand ID is required')
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid brand ID format'),
    year: z.number()
        .min(1900, 'Year must be after 1900')
        .max(new Date().getFullYear() + 1)
        .optional(),
    description: z.string()
        .max(2000)
        .optional(),
    imageUrl: z.string().url('Must be a valid URL').optional()
});

export const updateBicycleModelSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    year: z.number().min(1900).optional(),
    description: z.string().max(2000).optional(),
    imageUrl: z.string().url().optional(),
    isActive: z.boolean().optional()
});

export const bicycleModelIdParamSchema = z.object({
    id: z.string()
        .min(1, 'Model ID is required')
        .regex(/^[0-9a-fA-F]{24}$/, 'Invalid model ID format')
});

export const getBicycleModelsQuerySchema = z.object({
    brandId: z.string().optional(),
    search: z.string().optional(),
    isActive: z.enum(['true', 'false']).optional(),
    page: z.string()
        .regex(/^\d+$/, 'Page must be a number')
        .optional()
        .default('1'),
    limit: z.string()
        .regex(/^\d+$/, 'Limit must be a number')
        .optional()
        .default('10')
});

export type CreateBicycleModelInput = z.infer<typeof createBicycleModelSchema>;
export type UpdateBicycleModelInput = z.infer<typeof updateBicycleModelSchema>;
export type BicycleModelIdParam = z.infer<typeof bicycleModelIdParamSchema>;
export type GetBicycleModelsQuery = z.infer<typeof getBicycleModelsQuerySchema>;
