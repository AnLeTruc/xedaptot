import { z } from 'zod';

//Schema for object image/video
const mediaItemSchema = z.object({
    url: z.string().url('URL phải hợp lệ'),
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
    coordinates: z.array(z.number()).length(2, 'Toạ độ bản đồ phải bao gồm [kinh độ, vĩ độ]')
}).superRefine((value, context) => {
    const [longitude, latitude] = value.coordinates;

    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['coordinates'],
            message: 'Toạ độ bản đồ phải là số [kinh độ, vĩ độ] hợp lệ'
        });
    }
});




const locationSchema = z.object({
    fullName: z.string().min(1, 'Họ tên người bán là bắt buộc'),
    phone: z.string().min(1, 'Số điện thoại là bắt buộc'),
    provinceId: z.number().int().positive('Mã tỉnh/thành phố là bắt buộc'),
    districtId: z.number().int().positive('Mã quận/huyện là bắt buộc'),
    wardCode: z.string().min(1, 'Mã phường/xã là bắt buộc'),
    street: z.string().max(200, 'Tên đường/số nhà không được vượt quá 200 ký tự').optional(),
    coordinates: geoPointSchema.optional()
});



export const createBicycleSchema = z.object({
    title: z.string()
        .min(1, 'Tiêu đề là bắt buộc')
        .max(200, 'Tiêu đề không được vượt quá 200 ký tự'),
    price: z.number()
        .positive('Giá phải là số dương'),
    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'], {
        message: 'Tình trạng phải là: MỚI, NHƯ MỚI, TỐT, KHÁ hoặc KÉM'
    }),
    categoryId: z.string()
        .min(1, 'Danh mục là bắt buộc'),

    description: z.string()
        .max(5000, 'Mô tả không được vượt quá 5000 ký tự'),
    originalPrice: z.number()
        .positive('Giá gốc phải là số dương')
        .optional(),
    brandId: z.string().optional(),
    modelId: z.string().optional(),
    images: z.array(mediaItemSchema)
        .min(1, 'Ít nhất 1 hình ảnh là bắt buộc')
        .max(12, 'Tối đa 12 ảnh/video')
        .optional(),
    usageMonths: z.number().min(0).optional(),
    specifications: specificationsSchema,
    location: locationSchema,
})




export const updateBicycleSchema = z.object({
    title: z.string()
        .min(1, 'Tiêu đề không được để trống')
        .max(200, 'Tiêu đề không được vượt quá 200 ký tự')
        .optional(),

    description: z.string()
        .max(5000)
        .optional(),

    price: z.number()
        .positive('Giá phải là số dương')
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
        message: 'Trạng thái phải là: PENDING, APPROVED, SOLD, HIDDEN, hoặc REJECTED'
    }),
    reason: z.string().max(500).optional()
});




export const getBicyclesQuerySchema = z.object({
    status: z.enum(['PENDING', 'APPROVED', 'SOLD', 'HIDDEN', 'REJECTED']).optional(),
    condition: z.union([
        z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']),
        z.array(z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR']))
    ]).optional(),
    category: z.union([z.string(), z.array(z.string())]).optional(),
    brand: z.union([z.string(), z.array(z.string())]).optional(),
    sellerId: z.string().optional(),
    minPrice: z.string().optional(),
    maxPrice: z.string().optional(),
    provinceId: z.string().optional(),
    provinceName: z.string().optional(),
    search: z.string().optional(),
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
    sort: z.string().optional().default('-createdAt')
})




export const bicycleIdParamSchema = z.object({
    id: z.string().min(1, 'Mã xe đạp là bắt buộc')
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