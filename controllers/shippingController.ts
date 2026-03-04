import { Request, Response } from 'express';
import * as shippingService from '../services/shippingService';
import Bicycle from '../models/Bicycle';
import User from '../models/User';
import { AuthRequest } from '../types';

export const getProvinces = async (_req: Request, res: Response) => {
    try {
        const data = await shippingService.getProvinces();
        res.json({ success: true, data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getDistricts = async (req: Request, res: Response) => {
    try {
        const data = await shippingService.getDistricts(+req.params.provinceId);
        res.json({ success: true, data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const getWards = async (req: Request, res: Response) => {
    try {
        const data = await shippingService.getWards(+req.params.districtId);
        res.json({ success: true, data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
};

export const calculateFee = async (req: Request, res: Response) => {
    try {
        const { fromDistrictId, fromWardCode, toDistrictId, toWardCode, weight, insuranceValue } = req.body;
        const data = await shippingService.calculateShippingFee({
            fromDistrictId,
            fromWardCode,
            toDistrictId,
            toWardCode,
            weight,
            insuranceValue,
        });
        res.json({ success: true, data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
};


/**
 * POST /api/shipping/calculate-fee-for-bicycle
 * Body: { bicycleId, shippingAddressId }
 * Tự lấy from (bicycle.location / seller address) và to (buyer address) để tính phí ship
 */
export const calculateFeeForBicycle = async (req: AuthRequest, res: Response) => {
    try {
        const { bicycleId, shippingAddressId } = req.body;

        // Lấy bicycle
        const bicycle = await Bicycle.findById(bicycleId);
        if (!bicycle) {
            return res.status(404).json({ success: false, message: 'Bicycle not found' });
        }

        // Lấy buyer address
        const buyer = await User.findById(req.user!._id);
        const shippingAddr = buyer?.addresses?.find(
            (a: any) => a._id.toString() === shippingAddressId
        );
        if (!shippingAddr?.districtId || !shippingAddr?.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Invalid shipping address or missing district/ward code'
            });
        }

        // Xác định pickup (from) — ưu tiên bicycle.location, fallback seller address
        let fromDistrictId: number | undefined;
        let fromWardCode: string | undefined;

        if (bicycle.location?.districtId && bicycle.location?.wardCode) {
            fromDistrictId = bicycle.location.districtId;
            fromWardCode = bicycle.location.wardCode;
        } else {
            const seller = await User.findById(bicycle.seller._id);
            const sellerAddr = seller?.addresses?.find((a: any) => a.isDefault)
                || seller?.addresses?.[0];
            if (sellerAddr?.districtId && sellerAddr?.wardCode) {
                fromDistrictId = sellerAddr.districtId;
                fromWardCode = sellerAddr.wardCode;
            }
        }

        if (!fromDistrictId || !fromWardCode) {
            return res.status(400).json({
                success: false,
                message: 'Seller has not updated pickup address with shipping info'
            });
        }

        const data = await shippingService.calculateShippingFee({
            fromDistrictId,
            fromWardCode,
            toDistrictId: shippingAddr.districtId,
            toWardCode: shippingAddr.wardCode,
            weight: 15000,
            insuranceValue: bicycle.price,
        });

        res.json({ success: true, data });
    } catch (err: any) {
        res.status(500).json({ success: false, message: err.message });
    }
};
