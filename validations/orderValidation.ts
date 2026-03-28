import { z } from 'zod';
export const createOrderSchema = z.object({
    bicycleId: z.string().min(1),
    paymentType: z.enum(['DEPOSIT_10', 'FULL_100']),
    shippingAddressId: z.string().min(1),
    discountAmount: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountReason: z.string().optional(),
});
export const cancelOrderSchema = z.object({ reason: z.string().max(500).optional() });
export const reviewOrderSchema = z.object({ rating: z.number().min(1).max(5), comment: z.string().max(1000).optional() });

export const deliverOrderSchema = z.object({
    isSuccess: z.boolean({ message: 'Kết quả giao hàng là bắt buộc' }),
    images: z.array(z.string().url('URL ảnh không hợp lệ')).min(1, 'Cần ít nhất 1 ảnh bằng chứng'),
    failReason: z.string().max(500).optional(),
}).superRefine((val, ctx) => {
    if (!val.isSuccess && !val.failReason) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['failReason'],
            message: 'Lý do giao hàng thất bại là bắt buộc khi giao không thành công',
        });
    }
});

export const receiveOrderSchema = z.object({
    images: z.array(z.string().url('URL ảnh không hợp lệ')).min(1, 'Cần ít nhất 1 ảnh xác nhận nhận hàng').max(10, 'Tối đa 10 ảnh'),
});