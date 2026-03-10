import { Response, Request } from 'express';
import { AuthRequest } from '../types';
import ViolationReport from '../models/ViolationReport';
import User from '../models/User';
import Bicycle from '../models/Bicycle';


export const createViolationReport = async (
    req: AuthRequest,
    res: Response
): Promise<any> => {
    try {
        const userId = req.user!._id;
        const { reportedUserId, bicycleId, violationType, description } = req.body;

        if (userId.toString() === reportedUserId) {
            return res.status(400).json({
                success: false,
                message: 'You cannot report yourself',
            });
        }

        // Lấy thông tin user bị báo cáo và xe đạp
        const [reportedUser, bicycle] = await Promise.all([
            User.findById(reportedUserId),
            Bicycle.findById(bicycleId)
        ]);

        if (!reportedUser) {
            return res.status(404).json({
                success: false,
                message: 'Reported user not found',
            });
        }

        if (!bicycle) {
            return res.status(404).json({
                success: false,
                message: 'Bicycle not found',
            });
        }

        if (bicycle.seller._id.toString() !== reportedUserId) {
            return res.status(400).json({
                success: false,
                message: 'Bicycle does not belong to the reported user',
            });
        }

        const reporter = req.user!;

        // GIỮ NGUYÊN ĐOẠN MAP DỮ LIỆU NÀY MỚI ĐÚNG VỚI SCHEMA
        const violationReport = await ViolationReport.create({
            reporter: {
                _id: reporter._id,
                fullName: reporter.fullName,
                email: reporter.email,
            },
            reportedUser: {
                _id: reportedUser._id,
                fullName: reportedUser.fullName,
                email: reportedUser.email,
            },
            targetBicycle: {
                _id: bicycle._id,
                title: bicycle.title,
                price: bicycle.price,
                image: bicycle.images?.find(img => img.isPrimary)?.url
                    || bicycle.images?.[0]?.url,
                sellerId: bicycle.seller._id,
            },
            violationType,
            description,
        });

        res.status(201).json({
            success: true,
            message: 'Violation report created successfully',
            data: violationReport,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create violation report',
        });
    }
}

