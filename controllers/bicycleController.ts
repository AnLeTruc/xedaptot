import { Request, Response } from 'express';
import Bicycle from '../models/Bicycle';
import Category from '../models/Category';
import Brand from '../models/Brand';
import { AuthRequest } from '../types';




// GET /api/bicycles
export const getAllBicycles = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const {
            status,
            condition,
            category,
            brand,
            minPrice,
            maxPrice,
            city,
            search,
            page = 1,
            limit = 10,
            sort = '-createdAt'  // Mặc định sort mới nhất
        } = req.query;
        const filter: any = {};
        if (status) {
            filter.status = status;
        } else {
            filter.status = 'APPROVED';
        }
        if (condition) {
            filter.condition = condition;
        }
        if (category) {
            filter['category._id'] = category;
        }
        if (brand) {
            filter['brand._id'] = brand;
        }
        if (city) {
            filter['location.city'] = { $regex: city, $options: 'i' };
        }


        // Price range
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = Number(minPrice);
            if (maxPrice) filter.price.$lte = Number(maxPrice);
        }


        // Text search
        if (search) {
            filter.$text = { $search: search as string };
        }


        // Pagination
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;


        // Query
        const [bicycles, total] = await Promise.all([
            Bicycle.find(filter)
                .sort(sort as string)
                .skip(skip)
                .limit(limitNum),
            Bicycle.countDocuments(filter)
        ]);
        res.status(200).json({
            success: true,
            count: bicycles.length,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            data: bicycles
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// GET /api/bicycles/:id
export const getBicycleById = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const bicycle = await Bicycle.findById(id);

        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            });
            return;
        }

        // Tăng view count
        const updatedBicycle = await Bicycle.findByIdAndUpdate(
            id,
            { $inc: { viewCount: 1 } },
            { new: true }
        );
        res.status(200).json({
            success: true,
            data: updatedBicycle
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}




