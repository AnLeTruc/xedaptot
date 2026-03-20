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


const geoPointSchema = z.object({
    type: z.literal('Point').optional().default('Point'),
    coordinates: z.array(z.number()).length(2, 'Map coordinates must include [longitude, latitude]')
}).superRefine((value, context) => {
    const [longitude, latitude] = value.coordinates;

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['coordinates'],
            message: 'Map coordinates must include valid [longitude, latitude] numbers'
        });
    }
});




const locationSchema = z.object({
    fullName: z.string().min(1, 'Họ tên người bán (fullName) là bắt buộc'),
    phone: z.string().min(1, 'Số điện thoại (phone) là bắt buộc'),
    provinceId: z.number().int().positive('Province ID (GHN) is required'),
    districtId: z.number().int().positive('District ID (GHN) is required'),
    wardCode: z.string().min(1, 'Ward Code (GHN) is required'),
    street: z.string().max(200).optional(),
    coordinates: geoPointSchema.optional()
});



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
    modelId: z.string().optional(),
    images: z.array(mediaItemSchema)
        .min(1, 'At least 1 image is required')
        .max(12, 'Maximum 12 media items allowed')
        .optional(),
    usageMonths: z.number().min(0).optional(),
    specifications: specificationsSchema,
    location: locationSchema,
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
    modelId: z.string().optional(),
    specifications: specificationsSchema,
    location: locationSchema.optional(),
    images: z.array(mediaItemSchema).optional()
});



export const updateBicycleStatusSchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED'], {
        message: 'Status must be: PENDING, APPROVED, SOLD, HIDDEN, or REJECTED'
    }),
    reason: z.string().max(500).optional()
});




export const getBicyclesQuerySchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED']).optional(),
    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']).optional(),
    category: z.string().optional(),
    brand: z.string().optional(),
    sellerId: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    provinceId: z.string().optional(),
    search: z.string().optional(),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    sort: z.string().optional().default('-createdAt')
})




export const bicycleIdParamSchema = z.object({
    id: z.string().min(1, 'Bicycle ID is required')
});


export const getMyBicyclesQuerySchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED']).optional(),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    sort: z.string().optional().default('-createdAt')
});


export type CreateBicycleInput = z.infer<typeof createBicycleSchema>;
export type UpdateBicycleInput = z.infer<typeof updateBicycleSchema>;
export type UpdateBicycleStatusInput = z.infer<typeof updateBicycleStatusSchema>;
export type GetBicyclesQuery = z.infer<typeof getBicyclesQuerySchema>;
export type GetMyBicyclesQuery = z.infer<typeof getMyBicyclesQuerySchema>;
export type BicycleIdParam = z.infer<typeof bicycleIdParamSchema>;