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

//Create brand
export const createBrand = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, country } = req.body;

        if (!name || name.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Brand name is required'
            });
            return;
        }

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

        // Validate ObjectId format
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({
                success: false,
                message: 'Invalid brand ID format'
            });
            return;
        }

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

        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            res.status(400).json({
                success: false,
                message: 'Invalid brand ID format'
            });
            return;
        }

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
