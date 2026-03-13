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
        const { reportedUserId, bicycleId, violationType, description, images } = req.body;

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
            images: images || [],
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



export const getMyViolationReports = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = req.user!._id;

        const reports = await ViolationReport.find({
            'reportedUser._id': userId
        })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: reports,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get violation reports',
        });
    }
};




export const getViolationReportById = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const report = await ViolationReport.findById(req.params.id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Violation report not found',
            });
        }
        res.json({ success: true, data: report });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get violation report',
        });
    }
};




export const getAllViolationReports = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        // Hỗ trợ filter theo status
        const { status, page = 1, limit = 10 } = req.query;
        const filter: any = {};
        if (status) filter.status = status;
        const skip = (Number(page) - 1) * Number(limit);
        const [reports, total] = await Promise.all([
            ViolationReport.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            ViolationReport.countDocuments(filter),
        ]);
        res.json({
            success: true,
            data: reports,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get all violation reports',
        });
    }
};





// ADMIN: CẬP NHẬT STATUS
export const updateViolationReport = async (req: AuthRequest, res: Response) => {
    try {
        const { status, adminNotes } = req.body;
        const report = await ViolationReport.findById(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Violation report not found',
            });
        }
        report.status = status;
        if (adminNotes !== undefined) report.adminNotes = adminNotes;
        await report.save();
        res.json({
            success: true,
            message: 'Violation report updated successfully',
            data: report,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to update violation report',
        });
    }
};





export const checkViolationReport = async (
    req: AuthRequest,
    res: Response
): Promise<any> => {
    try {
        const userId = req.user!._id;
        const { bicycleId, reportedUserId } = req.query;

        const existing = await ViolationReport.findOne({
            'reporter._id': userId,
            'targetBicycle._id': bicycleId,
            'reportedUser._id': reportedUserId,
        });

        res.json({
            success: true,
            hasReported: !!existing,
            reportId: existing?._id ?? null,
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to check violation report',
        });
    }
};