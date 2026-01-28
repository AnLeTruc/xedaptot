import { z } from 'zod';
import { getCategoryById } from '../controllers/categoryController';


export const createCategorySchema = z.object({
    name: z.string()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name cannot exceed 100 characters'),
    description: z.string()
        .max(500, 'Description cannot exceed 500 characters'),
    imageUrl: z.string()
        .url('Invalid must be a valid URL').optional(),
    isActive: z.boolean().default(true),
})


export const updateCategorySchema = z.object({
    name: z.string()
        .min(1, 'Name cannot be empty')
        .max(100, 'Name cannot exceed 100 characters')
        .optional(),
    description: z.string()
        .max(500, 'Description cannot exceed 500 characters')
        .optional(),
    imageUrl: z.url('imageUrl must be a valid URL').optional(),
    isActive: z.boolean().optional()
});



export const getCategoriesQuerySchema = z.object({
    isActive: z.enum(['true', 'false']).optional(),
    search: z.string().optional()
});



export const categoryIdParamSchema = z.object({
    id: z.string().min(1, 'Category ID is required')
});



export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type GetCategoryQuery = z.infer<typeof getCategoriesQuerySchema>;
export type CategoryIdParam = z.infer<typeof categoryIdParamSchema>;