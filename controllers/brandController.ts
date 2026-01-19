import { Request, Response } from 'express';
import Brand from '../models/Brand';

//Get all brands
export const getAllBrands = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const brands = await Brand.find({ isActive: true });

        res.status(200).json({
            success: true,
            data: brands
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch brands'
        });
    }
};

