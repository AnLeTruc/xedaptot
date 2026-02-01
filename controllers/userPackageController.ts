import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import UserPackage from '../models/UserPackage';
import Package from '../models/Package';



// POST /api/user-packages/purchase
export const purchasePackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;

        const { packageId } = req.body;

        const packageItem = await Package.findById(packageId);
        if (!packageItem || !packageItem.isActive) {
            res.status(404).json({
                success: false,
                message: 'Package not found or is inactive'
            })
        }

        const packageSnapshot = {
            _id: packageItem?._id,
            name: packageItem?.code,
            code: packageItem?.code,
            postLimit: packageItem?.postLimit,
        }

        const userPackage = await UserPackage.create({
            userId,
            packageId,
            package: packageSnapshot,
            postedUsed: 0,
            postRemaining: packageItem?.postLimit,
            status: 'ACTIVE',
            purchasedAt: new Date(),
        })

        res.status(201).json({
            success: true,
            message: 'Package purchased successfully',
            userPackage
        })

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}




// GET /api/user-packages/myallpackages (lấy tất cả gói của user 'ACTIVE', 'EXPIRED', 'CANCELLED' - lịch sử gói)
export const getMyPackages = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user!._id;

        const { status } = req.query;

        const query: Record<string, any> = { userId };
        if (status) {
            query.status = status;
        }

        const userPackages = await UserPackage.find(query).sort({ purchasedAt: -1 });

        res.status(200).json({
            success: true,
            userPackages
        })

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}





// GET /api/user-packages/:id
export const getUserPackageById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user!._id;

        const userPackage = await UserPackage.findOne({ _id: id, userId });

        if (!userPackage) {
            res.status(404).json({
                success: false,
                message: 'Package not found'
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






// PATCH /api/user-packages/:id/use-post   -   Trừ 1 lượt đăng, auto EXPIRED nếu hết hạn

export const usePost = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user!._id;
        const userPackage = await UserPackage.findOne({
            _id: id,
            userId,
            status: 'ACTIVE'
        });


        if (!userPackage) {
            res.status(404).json({
                success: false,
                message: 'Active package not found'
            });
            return;
        }
        if (userPackage.postRemaining <= 0) {
            res.status(400).json({
                success: false,
                message: 'No posts remaining'
            });
            return;
        }

        userPackage.postedUsed += 1;
        userPackage.postRemaining -= 1;

        if (userPackage.postRemaining === 0) {
            userPackage.status = 'EXPIRED';
        }

        await userPackage.save();

        res.status(200).json({
            success: true,
            message: userPackage.status === 'EXPIRED'
                ? 'Post used. Package expired.'
                : 'Post used successfully',
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
export const cancelUserPackage = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const userId = req.user!._id;

        const userPackage = await UserPackage.findOne({ _id: id, userId });

        if (!userPackage) {
            res.status(404).json({
                success: false,
                message: 'Package not found'
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
            message: 'Package cancelled',
            data: userPackage
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
