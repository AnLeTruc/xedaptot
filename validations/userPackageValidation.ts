import { z } from 'zod';

// Helper: Validate MongoDB ObjectId
const objectIdSchema = z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectId format');

// POST /purchase - Body
export const purchasePackageSchema = z.object({
    packageId: objectIdSchema
});

// Các schema khác (thêm sau khi cần)
export const userPackageIdParamSchema = z.object({
    id: objectIdSchema
});

export const getMyPackagesQuerySchema = z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional()
});