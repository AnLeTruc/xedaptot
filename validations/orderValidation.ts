import { z } from 'zod';
export const createOrderSchema = z.object({
    bicycleId: z.string().min(1),
    paymentType: z.enum(['DEPOSIT_10', 'FULL_100']),
    // shippingAddressId: z.string().min(1),  // TODO: Team Shipping uncomment
    // shippingFee: z.number().min(0).optional(),  // TODO: Team Shipping uncomment
    discountAmount: z.number().min(0).optional(),
    discountPercent: z.number().min(0).max(100).optional(),
    discountReason: z.string().optional(),
});
export const cancelOrderSchema = z.object({ reason: z.string().max(500).optional() });
export const reviewOrderSchema = z.object({ rating: z.number().min(1).max(5), comment: z.string().max(1000).optional() });