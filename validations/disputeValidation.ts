import { z } from 'zod';

// Validation khi người dùng tạo đơn khiếu nại
export const createDisputeSchema = z.object({
    orderId: z.string().min(1, 'Order ID is required'),
    disputeType: z.enum([
        'ITEM_NOT_AS_DESCRIBED',
        'ITEM_NOT_RECEIVED',
        'DAMAGED_ITEM',
        'FAKE_ITEM',
        'OTHER'
    ]),
    reason: z.string()
        .min(1, 'Reason is required')
        .max(2000, 'Reason cannot exceed 2000 characters'),
    evidenceImages: z.array(z.string()).optional()
});

// Validation khi Admin giải quyết khiếu nại
export const resolveDisputeSchema = z.object({
    resolution: z.enum([
        'REFUND_BUYER',
        'RELEASE_SELLER',
        'NONE'
    ])
});
