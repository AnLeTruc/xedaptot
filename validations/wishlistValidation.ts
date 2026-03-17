import { z } from 'zod';



export const addToWishlistSchema = z.object({
    bicycleId: z.string().min(1, 'Bicycle ID is required')
});



export const wishlistBicycleParamSchema = z.object({
    bicycleId: z.string().min(1, 'Bicycle ID is required')
});



export const getWishlistQuerySchema = z.object({
    page: z.string().optional().default('1'),
    limit: z.string().optional().default('10'),
});



export type AddToWishlistInput = z.infer<typeof addToWishlistSchema>;
export type WishlistBicycleParamInput = z.infer<typeof wishlistBicycleParamSchema>;
export type GetWishlistQueryInput = z.infer<typeof getWishlistQuerySchema>;