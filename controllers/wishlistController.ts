import { Request, Response } from "express";
import { AuthRequest } from "../types";
import Wishlist from "../models/Wishlist";
import Bicycle from "../models/Bicycle";
import mongoose from "mongoose";
import { Auth } from "firebase-admin/lib/auth/auth";



export const addToWishlist = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { bicycleId } = req.body;
        const bicycle = await Bicycle.findById(bicycleId);

        if (!bicycle || bicycle.status !== 'APPROVED') {
            res.status(400).json({
                success: false,
                message: 'Bicycle not available for wishlist'
            });
            return;
        }

        if (bicycle.seller._id.toString() === req.user!._id.toString()) {
            res.status(400).json({
                success: false,
                message: 'Cannot add your own bicycle'
            });
            return;
        }

        const primaryImage = bicycle.images?.find(img => img.isPrimary)?.url || bicycle.images?.[0].url;

        const wishlistItem = await Wishlist.create({
            userId: req.user!._id,
            bicycleId: bicycle._id,
            bicycle: {
                _id: bicycle._id,
                title: bicycle.title,
                price: bicycle.price,
                primaryImage,
                condition: bicycle.condition,
                status: bicycle.status
            }
        });

        res.status(201).json({
            success: true,
            message: 'Bicycle added to wishlist',
            data: wishlistItem
        });
    } catch (error: any) {
        if (error.code === 11000) {
            res.status(409).json({
                success: false,
                message: 'Bicycle already added to wishlist'
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}



export const removeFromWishlist = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { bicycleId } = req.params;

        const wishlist = await Wishlist.findOneAndDelete({
            userId: req.user!._id,
            bicycleId
        });

        if (!wishlist) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found in wishlist'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Bicycle removed from wishlist'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}


export const getMyWishlist = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { page = '1', limit = '10' } = req.query;
        const pageNum = Math.max(1, Number(page));
        const limitNum = Math.min(50, Math.max(1, Number(limit)));
        const skip = (pageNum - 1) * limitNum;


        const [wishlist, totalItems] = await Promise.all([
            Wishlist.find({
                userId: req.user!._id
            })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Wishlist.countDocuments({
                userId: req.user!._id
            })
        ]);
        res.status(200).json({
            success: true,
            data: wishlist,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalItems,
                totalPages: Math.ceil(totalItems / limitNum)
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to fetch wishlist'
        });
    }
};




export const checkWishlist = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { bicycleId } = req.params;
        const item = await Wishlist.findOne({
            userId: req.user!._id,
            bicycleId
        }).select('_id');
        res.status(200).json({
            success: true,
            message: 'Check wishlist',
            data: { isWishlisted: item !== null, wishlistId: item?._id ?? null }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}






// Bất cứ khi nào chiếc xe thay đổi thông tin,
// tất cả những người đang lưu nó trong danh sách 
// yêu thích đều sẽ thấy thông tin mới nhất.
export const syncWishlistBicycle = async (
    bicycleId: any
): Promise<void> => {
    const bicycle = await Bicycle.findById(bicycleId).select('title price condition images status');
    if (!bicycle) return;

    const primaryImage = bicycle.images?.find(img => img.isPrimary)?.url || bicycle.images?.[0].url;

    await Wishlist.updateMany(
        { bicycleId },
        {
            $set: {
                'bicycle.title': bicycle.title,
                'bicycle.price': bicycle.price,
                'bicycle.condition': bicycle.condition,
                'bicycle.status': bicycle.status,
                'bicycle.primaryImage': primaryImage
            }
        }
    )
}
