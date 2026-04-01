import { Request, Response } from 'express';
import BicycleModel from '../models/BicycleModel';
import Brand from '../models/Brand';
import Bicycle from '../models/Bicycle';

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




export const createBicycleModel = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, brandId, year, description, imageUrl } = req.body;
        const brand = await Brand.findById(brandId);
        if (!brand) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy thương hiệu'
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
            message: 'Tạo mẫu xe thành công',
            data: bicycleModel
        });
    } catch (error: any) {
        // error.code === 11000: lỗi trùng unique index
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Tên mẫu xe đã tồn tại cho thương hiệu này'
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

        if (isActive === false) {
            const hasBicycles = await Bicycle.exists({ 'model._id': id });
            if (hasBicycles) {
                res.status(400).json({
                    success: false,
                    message: 'Không thể ẩn dòng xe này vì đang có xe đạp gắn với nó'
                });
                return;
            }
        }

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
            res.status(404).json({ success: false, message: 'Không tìm thấy mẫu xe' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Cập nhật mẫu xe thành công',
            data: model
        });
    } catch (error: any) {
        if (error.code === 11000) {
            res.status(400).json({ success: false, message: 'Tên mẫu xe đã tồn tại cho thương hiệu này' });
            return;
        }
        res.status(500).json({ success: false, message: error.message });
    }
};





// DELETE /api/bicycle-models/:id
export const deleteBicycleModel = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const hasBicycles = await Bicycle.exists({ 'model._id': id });
        if (hasBicycles) {
            res.status(400).json({
                success: false,
                message: 'Không thể xoá dòng xe này vì đang có xe đạp gắn với nó'
            });
            return;
        }

        const model = await BicycleModel.findByIdAndDelete(id);
        if (!model) {
            res.status(404).json({ success: false, message: 'Không tìm thấy mẫu xe' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Xoá mẫu xe thành công'
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};
