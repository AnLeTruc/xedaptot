import { z } from 'zod';

const objectIdSchema = z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

export const purchasePackageSchema = z.object({
    packageId: objectIdSchema
});

export const userPackageIdParamSchema = z.object({
    id: objectIdSchema
});

export const getMyPackagesQuerySchema = z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional()
});