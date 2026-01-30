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



