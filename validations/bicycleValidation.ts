import { z } from 'zod';

//Schema for object image/video
const mediaItemSchema = z.object({
    url: z.string().url('URL must be valid'),
    isPrimary: z.boolean().optional().default(false),
    mediaType: z.enum(['image', 'video']),
    displayOrder: z.number().optional()
});


const specificationsSchema = z.object({
    yearManufactured: z.number().min(1900).max(new Date().getFullYear()),
    frameSize: z.string().optional(),
    frameMaterial: z.string().optional(),
    wheelSize: z.string().optional(),
    gearCount: z.number().min(1).max(30).optional(),
    brakeType: z.string().optional(),
    color: z.string().optional(),
    weight: z.number().positive().optional()
}).optional();




const locationSchema = z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    coordinates: z.object({
        type: z.literal('Point').optional(),
        coordinates: z.array(z.number()).length(2).optional()
    }).optional()
}).optional();



export const createBicycleSchema = z.object({
    title: z.string()
        .min(1, 'Title is required')
        .max(200, ' Title cannot exceed 200 characters'),
    price: z.number()
        .positive('Price must be positive'),
    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'], {
        message: 'Condition must be: NEW, LIKE_NEW, GOOD, FAIR OR POOR'
    }),
    categoryId: z.string()
        .min(1, 'Category is required'),

    description: z.string()
        .max(5000, 'Description cannot exceed 5000 characters'),
    originalPrice: z.number()
        .positive('Original price must be positive')
        .optional(),
    brandId: z.string().optional(),
    images: z.array(mediaItemSchema)
        .min(1, 'At least 1 image is required')
        .max(12, 'Maximum 12 media items allowed')
        .optional()
})




export const updateBicycleSchema = z.object({
    title: z.string()
        .min(1, 'Title cannot be empty')
        .max(200, 'Title cannot exceed 200 characters')
        .optional(),

    description: z.string()
        .max(5000)
        .optional(),

    price: z.number()
        .positive('Price must be positive')
        .optional(),

    originalPrice: z.number()
        .positive()
        .optional(),

    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'])
        .optional(),

    usageMonths: z.number()
        .min(0)
        .optional(),

    categoryId: z.string().optional(),
    brandId: z.string().optional(),
    specifications: specificationsSchema,
    location: locationSchema,
    images: z.array(mediaItemSchema).optional()
});



export const updateBicycleStatusSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED'], {
        message: 'Status must be: PENDING, APPROVED, SOLD, HIDDEN, or REJECTED'
    })
});




export const getBicyclesQuerySchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED']).optional(),
    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    city: z.string().optional(),
    search: z.string().optional(),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    sort: z.string().optional().default('-createdAt')
})




export const bicycleIdParamSchema = z.object({
    id: z.string().min(1, 'Bicycle ID is required')
});




export type CreateBicycleInput = z.infer<typeof createBicycleSchema>;
export type UpdateBicycleInput = z.infer<typeof updateBicycleSchema>;
export type UpdateBicycleStatusInput = z.infer<typeof updateBicycleStatusSchema>;
export type GetBicyclesQuery = z.infer<typeof getBicyclesQuerySchema>;
export type BicycleIdParam = z.infer<typeof bicycleIdParamSchema>;