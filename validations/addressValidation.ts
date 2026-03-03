import { z } from 'zod';

export const addAddressSchema = z.object({
    label: z.string().min(1, 'Label is required').max(50),
    street: z.string().max(200).optional(),
    ward: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    city: z.string().min(1, 'City is required').max(100),
    provinceId: z.number().int().positive('Province ID (GHN) is required'),
    districtId: z.number().int().positive('District ID (GHN) is required'),
    wardCode: z.string().min(1, 'Ward Code (GHN) is required'),
    isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = z.object({
    label: z.string().min(1).max(50).optional(),
    street: z.string().max(200).optional(),
    ward: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    city: z.string().min(1).max(100).optional(),
    provinceId: z.number().int().positive().optional(),
    districtId: z.number().int().positive().optional(),
    wardCode: z.string().min(1).optional(),
    isDefault: z.boolean().optional(),
});

export type AddAddressInput = z.infer<typeof addAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
