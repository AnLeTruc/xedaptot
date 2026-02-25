import { Request, Response } from 'express';
import BicycleModel from '../models/BicycleModel';
import Brand from '../models/Brand';

// GET /api/bicycle-models
export const getAllBicycleModels = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { brandId, search, isActive, page = '1', limit = '10' } = req.query;
        const filter: any = {};

        if (brandId) filter['brand._id'] = brandId;
        if (search) filter.name = { $regex: search, $options: 'i' };
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        } else {
            filter.isActive = true;
        }

        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(100, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;
        const [models, total] = await Promise.all([
            BicycleModel.find(filter).sort({ name: 1 }).skip(skip).limit(limitNum),
            BicycleModel.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: models,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: total > 0 ? Math.ceil(total / limitNum) : 0
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};   