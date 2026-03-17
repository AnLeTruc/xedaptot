import { Request, Response } from "express";
import { AuthRequest } from "../types";
import Wishlist from "../models/Wishlist";
import Bicycle from "../models/Bicycle";



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