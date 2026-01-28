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


// GET api/packages/:id
export const getPackageById = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const packageItem = await Package.findById(id);
        if (!packageItem) {
            res.status(404).json({
                success: false,
                message: 'Package not found'
            });
            return;
        }
        res.status(200).json({
            success: true,
            data: packageItem
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}




// POST /api/packages (Admin only)
export const createPackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { name, code, price, postLimit, isActive } = req.body;
        const existingPackage = await Package.findOne({ code: code.toUpperCase() });
        if (existingPackage) {
            res.status(400).json({
                success: false,
                message: 'Package code already exists'
            });
            return;
        }
        const newPackage = await Package.create({
            name,
            code,
            price,
            postLimit,
            isActive: isActive ?? true
        });
        res.status(201).json({
            success: true,
            message: 'Package created successfully',
            data: newPackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};





// PUT /api/packages/:id (Admin only)
export const updatePackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { name, code, price, postLimit, isActive } = req.body;
        const packageItem = await Package.findById(id);
        if (!packageItem) {
            res.status(404).json({
                success: false,
                message: 'Package not found'
            });
            return;
        }
        if (code && code.toUpperCase() !== packageItem.code) {
            const existingPackage = await Package.findOne({ code: code.toUpperCase() });
            if (existingPackage) {
                res.status(400).json({
                    success: false,
                    message: 'Package code already exists'
                });
                return;
            }
        }
        if (name !== undefined) packageItem.name = name;
        if (code !== undefined) packageItem.code = code;
        if (price !== undefined) packageItem.price = price;
        if (postLimit !== undefined) packageItem.postLimit = postLimit;
        if (isActive !== undefined) packageItem.isActive = isActive;
        await packageItem.save();
        res.json({
            success: true,
            message: 'Package updated successfully',
            data: packageItem
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};




// DELETE /api/packages/:id (Admin only)
export const deletePackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const packageItem = await Package.findById(id);
        if (!packageItem) {
            res.status(404).json({
                success: false,
                message: 'Package not found'
            });
            return;
        }
        await packageItem.deleteOne();
        res.json({
            success: true,
            message: 'Package deleted successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};