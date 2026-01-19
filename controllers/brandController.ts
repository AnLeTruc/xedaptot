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
            message: 'Failed to fetch brands'
        });
    }
};

//Create new brand (Admin only)
export const createBrand = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { name, country } = req.body;

        // Validate required field
        if (!name || name.trim() === '') {
            res.status(400).json({
                success: false,
                message: 'Brand name is required'
            });
            return;
        }

        // Create brand
        const brand = await Brand.create({
            name: name.trim(),
            country: country?.trim() || ''
        });

        res.status(201).json({
            success: true,
            message: 'Brand created successfully',
            data: brand
        });
    } catch (error: any) {
        // Handle duplicate key error
        if (error.code === 11000) {
            res.status(400).json({
                success: false,
                message: 'Brand already exists'
            });
            return;
        }

        console.error('Create brand error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create brand'
        });
    }
};
