import { z } from 'zod';

export const createViolationReportSchema = z.object({
    reportedUserId: z.string().min(1, 'Reported user ID is require'),
    bicycleId: z.string().min(1, 'Bicycle ID is required'),
    violationType: z.enum([
        'FRAUD', 'FAKE_LISTING', 'INAPPROPRIATE', 'STOLEN_BICYCLE', 'DUPLICATE_LISTING', 'OTHER'
    ]),
    description: z.string()
        .min(1, 'Description is required')
        .max(2000, 'Description cannot exceed 2000 characters'),
});


export const updateViolationReportSchema = z.object({
    status: z.enum(['REVIEWING', 'RESOLVE', 'REJECTED']),
    adminNotes: z.string()
        .max(2000, 'Admin notes cannot exceed 2000 characters'),
})