import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import UserPackage from '../models/UserPackage';
import Package from '../models/Package';



// GET /api/user-packages/me
// Get all packages for current user
export const getMyPackages = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        const { status } = req.query;

        const query: any = { userId };
        if (status) {
            query.status = status;
        }

        const packages = await UserPackage.find(query)
            .sort({ purchasedAt: -1 });

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



// GET /api/user-packages/me/active
// Get current user's active package
export const getMyActivePackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;

        const activePackage = await UserPackage.findOne({
            userId,
            status: 'ACTIVE'
        });

        if (!activePackage) {
            res.status(404).json({
                success: false,
                message: 'No active package found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: activePackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// GET /api/user-packages/:id
// Get user package by ID
export const getUserPackageById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const userPackage = await UserPackage.findOne({
            _id: id,
            userId
        });

        if (!userPackage) {
            res.status(404).json({
                success: false,
                message: 'User package not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: userPackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// POST /api/user-packages/purchase
// Purchase a new package
export const purchasePackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        const { packageId } = req.body;

        if (!packageId) {
            res.status(400).json({
                success: false,
                message: 'Package ID is required'
            });
            return;
        }

        // Check if user already has an active package
        const existingActive = await UserPackage.findOne({
            userId,
            status: 'ACTIVE'
        });

        if (existingActive) {
            res.status(400).json({
                success: false,
                message: 'You already have an active package. Please cancel it first.'
            });
            return;
        }

        // Find the package
        const packageItem = await Package.findById(packageId);
        if (!packageItem) {
            res.status(404).json({
                success: false,
                message: 'Package not found'
            });
            return;
        }

        if (!packageItem.isActive) {
            res.status(400).json({
                success: false,
                message: 'This package is not available'
            });
            return;
        }

        // Create user package with snapshot
        const userPackage = await UserPackage.create({
            userId,
            packageId: packageItem._id,
            package: {
                _id: packageItem._id,
                name: packageItem.name,
                code: packageItem.code,
                postLimit: packageItem.postLimit
            },
            postedUsed: 0,
            postRemaining: packageItem.postLimit,
            status: 'ACTIVE',
            purchasedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Package purchased successfully',
            data: userPackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



// PATCH /api/user-packages/:id/cancel
// Cancel a user package
export const cancelUserPackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;

        const userPackage = await UserPackage.findOne({
            _id: id,
            userId
        });

        if (!userPackage) {
            res.status(404).json({
                success: false,
                message: 'User package not found'
            });
            return;
        }

        if (userPackage.status !== 'ACTIVE') {
            res.status(400).json({
                success: false,
                message: 'Only active packages can be cancelled'
            });
            return;
        }

        userPackage.status = 'CANCELLED';
        await userPackage.save();

        res.status(200).json({
            success: true,
            message: 'Package cancelled successfully',
            data: userPackage
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};





// GET /api/user-packages (Admin only - Xem tất cả gói của tất cả user)
export const getAllUserPackages = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { userId, status, page = 1, limit = 20 } = req.query;

        const query: Record<string, any> = {};
        if (userId) query.userId = userId;
        if (status) query.status = status;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;

        const [packages, total] = await Promise.all([
            UserPackage.find(query)
                .populate('userId', 'fullName email')
                .sort({ purchasedAt: -1 })
                .skip(skip)
                .limit(limitNum),
            UserPackage.countDocuments(query)
        ]);

        res.status(200).json({
            success: true,
            count: packages.length,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            data: packages
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};