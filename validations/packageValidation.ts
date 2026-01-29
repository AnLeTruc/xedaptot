import { z } from 'zod';

export const createPackageSchema = z.object({
    name: z.string()
        .min(1, 'Name is required')
        .max(100, 'Name cannot exceed 100 characters'),

    code: z.string()
        .min(1, 'Code is required')
        .max(20, 'Code cannot exceed 20 characters')
        .toUpperCase(),

    price: z.number()
        .min(0, 'Price cannot be negative'),

    postLimit: z.number()
        .int('Post limit must be an integer')
        .min(0, 'Post limit cannot be negative'),

    isActive: z.boolean().optional().default(true)
});


export const updatePackageSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().min(1).max(20).toUpperCase().optional(),
    price: z.number().min(0).optional(),
    postLimit: z.number().int('Post limit must be an integer').min(0).optional(),
    isActive: z.boolean().optional()
});


export const getPackagesQuerySchema = z.object({
    isActive: z.enum(['true', 'false']).optional()
});

export const packageIdParamSchema = z.object({
    id: z.string().min(1, 'Package ID is required')
});


export type CreatePackageInput = z.infer<typeof createPackageSchema>;
export type UpdatePackageInput = z.infer<typeof updatePackageSchema>;
export type GetPackagesQuery = z.infer<typeof getPackagesQuerySchema>;
export type PackageIdParam = z.infer<typeof packageIdParamSchema>;