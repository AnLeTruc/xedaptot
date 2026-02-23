import { Response } from 'express';
import { AuthRequest } from '../types';
import Bicycle from '../models/Bicycle';
import InspectionReport from '../models/InspectionReport';
import Notification from '../models/Notification';
import User from '../models/User';

// GET /inspectors/me - Get inspector profile
export const getMyProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const inspectorId = req.user?._id;

        // Get inspection stats
        const totalInspections = await InspectionReport.countDocuments({ inspectorId });
        const completedInspections = await InspectionReport.countDocuments({
            inspectorId,
            status: 'COMPLETED'
        });
        const pendingAssigned = await InspectionReport.countDocuments({
            inspectorId,
            status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
        });

        res.status(200).json({
            success: true,
            data: {
                profile: req.user,
                stats: {
                    totalInspections,
                    completedInspections,
                    pendingAssigned
                }
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /inspectors/bicycles - Get available bicycles (assigned + pending)
export const getBicycles = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const inspectorId = req.user?._id;
        const { filter } = req.query; // 'assigned' | 'available' | 'all'

        let bicycles;

        if (filter === 'assigned') {
            // Only bicycles assigned to this inspector
            bicycles = await Bicycle.find({
                assignedInspectorId: inspectorId,
                inspectionStatus: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
            }).sort({ updatedAt: -1 });
        } else if (filter === 'available') {
            // Bicycles with PENDING status (can be claimed)
            bicycles = await Bicycle.find({
                inspectionStatus: 'PENDING',
                status: 'APPROVED'
            }).sort({ createdAt: -1 });
        } else {
            // All: assigned to me + available
            bicycles = await Bicycle.find({
                $or: [
                    { assignedInspectorId: inspectorId },
                    { inspectionStatus: 'PENDING', status: 'APPROVED' }
                ]
            }).sort({ createdAt: -1 });
        }

        res.status(200).json({
            success: true,
            count: bicycles.length,
            data: bicycles
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// POST /inspectors/bicycles/:id/claim - Claim a bicycle for inspection
export const claimBicycle = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const inspectorId = req.user?._id;

        const bicycle = await Bicycle.findById(id);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            });
            return;
        }

        // Check if bicycle is available for claiming
        if (bicycle.inspectionStatus !== 'PENDING') {
            res.status(400).json({
                success: false,
                message: 'Bicycle is not available for inspection'
            });
            return;
        }

        // Update bicycle
        bicycle.inspectionStatus = 'IN_PROGRESS';
        bicycle.assignedInspectorId = inspectorId;
        await bicycle.save();

        // Create inspection report
        const report = await InspectionReport.create({
            bicycleId: id,
            inspectorId,
            status: 'IN_PROGRESS'
        });

        res.status(200).json({
            success: true,
            message: 'Bicycle claimed successfully',
            data: {
                bicycle,
                inspectionReport: report
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /inspectors/reports - Get my inspection reports
export const getMyReports = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const inspectorId = req.user?._id;
        const { status } = req.query;

        const query: any = { inspectorId };
        if (status) {
            query.status = status;
        }

        const reports = await InspectionReport.find(query)
            .populate('bicycleId', 'title images seller')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// POST /inspectors/reports - Create/Submit inspection report
export const submitReport = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const inspectorId = req.user?._id;
        const { bicycleId, conditions, overallRating, isPassed, notes, images } = req.body;

        if (!bicycleId || !conditions || overallRating === undefined || isPassed === undefined) {
            res.status(400).json({
                success: false,
                message: 'bicycleId, conditions, overallRating, and isPassed are required'
            });
            return;
        }

        // Find existing report or bicycle
        let report = await InspectionReport.findOne({
            bicycleId,
            inspectorId,
            status: { $in: ['ASSIGNED', 'IN_PROGRESS'] }
        });

        const bicycle = await Bicycle.findById(bicycleId);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Bicycle not found'
            });
            return;
        }

        // Check if inspector is assigned
        if (bicycle.assignedInspectorId?.toString() !== inspectorId?.toString()) {
            res.status(403).json({
                success: false,
                message: 'You are not assigned to inspect this bicycle'
            });
            return;
        }

        const now = new Date();

        if (report) {
            // Update existing report
            report.conditions = conditions;
            report.overallRating = overallRating;
            report.isPassed = isPassed;
            report.notes = notes;
            report.images = images;
            report.status = isPassed ? 'COMPLETED' : 'REJECTED';
            report.completedAt = now;
            report.submittedAt = now;
            await report.save();
        } else {
            // Create new report
            report = await InspectionReport.create({
                bicycleId,
                inspectorId,
                conditions,
                overallRating,
                isPassed,
                notes,
                images,
                status: isPassed ? 'COMPLETED' : 'REJECTED',
                completedAt: now,
                submittedAt: now
            });
        }

        // Update bicycle
        bicycle.isInspected = true;
        bicycle.inspectionStatus = isPassed ? 'COMPLETED' : 'REJECTED';
        bicycle.inspectionReportId = report._id;
        await bicycle.save();

        // Notify seller
        await Notification.create({
            userId: bicycle.seller._id,
            type: 'INSPECTION_COMPLETED',
            title: 'Inspection Completed',
            content: `Your bicycle "${bicycle.title}" has been inspected. Result: ${isPassed ? 'PASSED' : 'FAILED'}`,
            metadata: {
                bicycleId,
                inspectionReportId: report._id
            }
        });

        res.status(201).json({
            success: true,
            message: 'Inspection report submitted successfully',
            data: report
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /inspectors/reports/:id - Get report by ID
export const getReportById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const inspectorId = req.user?._id;

        const report = await InspectionReport.findOne({
            _id: id,
            inspectorId
        }).populate('bicycleId');

        if (!report) {
            res.status(404).json({
                success: false,
                message: 'Report not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: report
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /inspectors/notifications - Get inspector notifications
export const getNotifications = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const inspectorId = req.user?._id;

        const notifications = await Notification.find({ userId: inspectorId })
            .sort({ createdAt: -1 })
            .limit(50);

        res.status(200).json({
            success: true,
            count: notifications.length,
            data: notifications
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// PATCH /inspectors/notifications/:id/read - Mark notification as read
export const markNotificationRead = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const inspectorId = req.user?._id;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId: inspectorId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            res.status(404).json({
                success: false,
                message: 'Notification not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: notification
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
