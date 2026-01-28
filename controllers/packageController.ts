import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import Package from '../models/Package';



// GET /api/packages
export const getAllPackages = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { isActive } = req.query;
        const query: any = {};
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }
        const packages = await Package.find(query).sort({ price: 1 });
        res.status(200).json({
            success: true,
            count: packages.length,
            data: packages
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
