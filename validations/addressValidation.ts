import { z } from 'zod';

const geoSchema = z.object({
    type: z.literal('Point').optional(),
    coordinates: z.array(z.number()).length(2).optional()
}).optional();

const baseAddressFieldsSchema = z.object({
    fullName: z.string().min(1, 'Họ tên người nhận (fullName) là bắt buộc'),
    phone: z.string().min(1, 'Số điện thoại (phone) là bắt buộc'),
    provinceId: z.number().int().positive('Province ID (GHN) is required'),
    districtId: z.number().int().positive('District ID (GHN) is required'),
    wardCode: z.string().min(1, 'Ward Code (GHN) is required'),
    street: z.string().max(200).optional(),
    coordinates: geoSchema
});

export const addAddressSchema = z.object({
    label: z.string().min(1, 'Label is required').max(50),
    isDefault: z.boolean().optional().default(false),
    ...baseAddressFieldsSchema.shape
});

export const updateAddressSchema = z.object({
    label: z.string().min(1).max(50).optional(),
    isDefault: z.boolean().optional(),
    provinceId: z.number().int().positive().optional(),
    districtId: z.number().int().positive().optional(),
    wardCode: z.string().min(1).optional(),
    street: z.string().max(200).optional(),
    coordinates: geoSchema
});

export type AddAddressInput = z.infer<typeof addAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
