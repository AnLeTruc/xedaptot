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
            return res.status(404).json({ success: false, message: 'Không tìm thấy xe đạp' });
        }

        // Lấy buyer address
        const buyer = await User.findById(req.user!._id);
        const shippingAddr = buyer?.addresses?.find(
            (a: any) => a._id.toString() === shippingAddressId
        );
        if (!shippingAddr?.districtId || !shippingAddr?.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ giao hàng không hợp lệ hoặc thiếu mã quận/phường'
            });
        }

        // Pickup (from) must come from bicycle.location
        if (!bicycle.location?.districtId || !bicycle.location?.wardCode) {
            return res.status(400).json({
                success: false,
                message: 'Địa chỉ lấy hàng xe đạp thiếu mã quận/phường GHN'
            });
        }

        const data = await shippingService.calculateShippingFee({
            fromDistrictId: bicycle.location.districtId,
            fromWardCode: bicycle.location.wardCode,
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
