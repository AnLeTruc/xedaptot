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




export const createBicycleModels = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, brandId, year, description, imageUrl } = req.body;
        const brand = await Brand.findById(brandId);
        if (!brand) {
            res.status(404).json({
                success: false,
                message: 'Brand not found'
            });
            return;
        }
        const bicycleModel = new BicycleModel({
            name: name.trim(),
            brand: {
                _id: brand._id,
                name: brand.name
            },
            year,
            description,
            imageUrl
        });
        await bicycleModel.save();
        res.status(201).json({
            success: true,
            message: 'Bicycle model created successfully',
            data: bicycleModel
        });
    } catch (error: any) {
        // error.code === 11000: lỗi trùng unique index
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Model name already exists for this brand'
            });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};




// PUT /api/bicycle-models/:id
export const updateBicycleModel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, year, description, imageUrl, isActive } = req.body;
        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (year !== undefined) updateData.year = year;
        if (description !== undefined) updateData.description = description;
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (isActive !== undefined) updateData.isActive = isActive;
        const model = await BicycleModel.findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true
        });
        if (!model) {
            res.status(404).json({ success: false, message: 'Bicycle model not found' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Bicycle model updated successfully',
            data: model
        });
    } catch (error: any) {
        if (error.code === 11000) {
            res.status(400).json({ success: false, message: 'Model name already exists for this brand' });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};




