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


