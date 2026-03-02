import { Request, Response } from 'express';
import * as shippingService from '../services/shippingService';

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
