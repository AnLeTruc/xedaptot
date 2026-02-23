import { Request, Response } from 'express';
import Brand from '../models/Brand';

//Get all brands
export const getAllBrands = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { page = '1', limit = '10', search, isActive } = req.query;

        let pageNum = parseInt(page as string, 10);
        let limitNum = parseInt(limit as string, 10);

        // Validation
        if (isNaN(pageNum) || pageNum < 1) {
            pageNum = 1;
        }
        if (isNaN(limitNum) || limitNum < 1) {
            limitNum = 10;
        }
        if (limitNum > 100) {
            limitNum = 100;
        }

        const skip = (pageNum - 1) * limitNum;

        const filter: any = {};
        if (isActive !== undefined) {
            filter.isActive = isActive === 'true';
        } else {
            filter.isActive = true;
        }

        if (search) {
            filter.name = { $regex: search, $options: 'i' };
        }

        const [brands, total] = await Promise.all([
            Brand.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Brand.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            data: brands,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: total > 0 ? Math.ceil(total / limitNum) : 0
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch brands'
        });
    }
};

//Create brand
export const createBrand = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, country } = req.body;

        const brand = await Brand.create({
            name: name.trim(),
            country: country?.trim()
        });

        res.status(201).json({
            success: true,
            message: 'Brand created successfully',
            data: brand
        });
    } catch (error: any) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Brand already exits'
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Failed to create brand'
        });
    }
};

//Update brand
export const updateBrand = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const id = req.params.id as string;
        const { name, country, imageUrl, isActive } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (country !== undefined) updateData.country = country.trim();
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl.trim();
        if (isActive !== undefined) updateData.isActive = isActive;

        const brand = await Brand.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!brand) {
            res.status(404).json({
                success: false,
                message: 'Brand not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Brand updated successfully',
            data: brand
        });
    } catch (error: any) {
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Brand name already exists'
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update brand'
        });
    }
};

//Delete brand
export const deleteBrand = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const id = req.params.id as string;

        const deletedBrand = await Brand.findByIdAndDelete(id);

        if (!deletedBrand) {
            res.status(404).json({
                success: false,
                message: 'Brand not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Brand deleted successfully',
            data: deletedBrand
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete brand'
        });
    }
};
