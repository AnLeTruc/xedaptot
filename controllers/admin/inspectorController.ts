import { Response } from 'express';
import { AuthRequest } from '../../types';
import User from '../../models/User';
import Bicycle from '../../models/Bicycle';
import InspectionReport from '../../models/InspectionReport';
import Notification from '../../models/Notification';
import { sendInspectorWelcomeEmail } from '../../services/emailService';
import crypto from 'crypto';

// Firebase Admin
const { auth: firebaseAuth } = require('../../config/firebase');

// Helper: Generate random password
const generatePassword = (): string => {
    return crypto.randomBytes(8).toString('hex');
};

// POST /admin/inspectors - Create inspector account
export const createInspector = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { email, fullName, phone } = req.body;

        if (!email || !fullName) {
            res.status(400).json({
                success: false,
                message: 'Email và họ tên là bắt buộc'
            });
            return;
        }

        // Check if email already exists in MongoDB
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: 'Email đã được đăng ký'
            });
            return;
        }

        // Generate default password
        const defaultPassword = generatePassword();

        // Create Firebase user
        let firebaseUser;
        try {
            firebaseUser = await firebaseAuth.createUser({
                email,
                password: defaultPassword,
                displayName: fullName,
                emailVerified: true
            });
        } catch (firebaseError: any) {
            // Check if user already exists in Firebase
            if (firebaseError.code === 'auth/email-already-exists') {
                res.status(400).json({
                    success: false,
                    message: 'Email đã được đăng ký trên Firebase'
                });
                return;
            }
            throw firebaseError;
        }

        // Create inspector user in MongoDB
        const inspector = await User.create({
            email,
            fullName,
            phone,
            roles: ['INSPECTOR'],
            isVerified: true,
            isActive: true,
            authProvider: 'email',
            reputationScore: 0,
            firebaseUId: firebaseUser.uid
        });

        // Send email with credentials
        const emailSent = await sendInspectorWelcomeEmail(email, defaultPassword, fullName);

        res.status(201).json({
            success: true,
            message: emailSent
                ? 'Inspector created successfully. Email sent with credentials.'
                : 'Inspector created but email failed to send.',
            data: {
                _id: inspector._id,
                email: inspector.email,
                fullName: inspector.fullName,
                firebaseUid: firebaseUser.uid,
                emailSent,
                // Only show password in response for demo, remove in production
                tempPassword: defaultPassword
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /admin/inspectors - Get all inspectors
export const getAllInspectors = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { isActive } = req.query;
        const query: any = { roles: 'INSPECTOR' };

        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const inspectors = await User.find(query)
            .select('-passwordResetCodeHash -passwordResetTokenHash -emailVerificationToken')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: inspectors.length,
            data: inspectors
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /admin/inspectors/:id - Get inspector by ID
export const getInspectorById = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const inspector = await User.findOne({ _id: id, roles: 'INSPECTOR' })
            .select('-passwordResetCodeHash -passwordResetTokenHash -emailVerificationToken');

        if (!inspector) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy kiểm định viên'
            });
            return;
        }

        // Get inspection stats
        const totalInspections = await InspectionReport.countDocuments({ inspectorId: id });
        const completedInspections = await InspectionReport.countDocuments({
            inspectorId: id,
            status: 'COMPLETED'
        });

        res.status(200).json({
            success: true,
            data: {
                ...inspector.toObject(),
                stats: {
                    totalInspections,
                    completedInspections
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

// PATCH /admin/inspectors/:id - Update inspector
export const updateInspector = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { fullName, phone, isActive } = req.body;

        const inspector = await User.findOneAndUpdate(
            { _id: id, roles: 'INSPECTOR' },
            { fullName, phone, isActive },
            { new: true, runValidators: true }
        ).select('-passwordResetCodeHash -passwordResetTokenHash -emailVerificationToken');

        if (!inspector) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy kiểm định viên'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật kiểm định viên thành công',
            data: inspector
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// DELETE /admin/inspectors/:id - Deactivate inspector
export const deleteInspector = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const inspector = await User.findOneAndUpdate(
            { _id: id, roles: 'INSPECTOR' },
            { isActive: false },
            { new: true }
        );

        if (!inspector) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy kiểm định viên'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Vô hiệu hoá kiểm định viên thành công'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// POST /admin/bicycles/:bicycleId/assign-inspector - Assign inspector to bicycle
export const assignInspector = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { bicycleId } = req.params;
        const { inspectorId } = req.body;
        const adminId = req.user?._id;

        if (!inspectorId) {
            res.status(400).json({
                success: false,
                message: 'Mã kiểm định viên là bắt buộc'
            });
            return;
        }

        // Verify inspector exists and is active
        const inspector = await User.findOne({
            _id: inspectorId,
            roles: 'INSPECTOR',
            isActive: true
        });

        if (!inspector) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy kiểm định viên hoặc đã vô hiệu hoá'
            });
            return;
        }

        // Find bicycle
        const bicycle = await Bicycle.findById(bicycleId);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy xe đạp'
            });
            return;
        }

        // Check if already has active inspection
        if (bicycle.inspectionStatus === 'IN_PROGRESS' || bicycle.inspectionStatus === 'COMPLETED') {
            res.status(400).json({
                success: false,
                message: 'Xe đạp này đã có yêu cầu kiểm định đang thực hiện hoặc đã hoàn thành'
            });
            return;
        }

        // Update bicycle
        bicycle.inspectionStatus = 'ASSIGNED';
        bicycle.assignedInspectorId = inspectorId;
        await bicycle.save();

        // Create inspection report
        const report = await InspectionReport.create({
            bicycleId,
            inspectorId,
            assignedBy: adminId,
            status: 'ASSIGNED'
        });

        // Create notification for inspector
        await Notification.create({
            userId: inspectorId,
            type: 'INSPECTION_ASSIGNED',
            title: 'New Inspection Assignment',
            message: `You have been assigned to inspect: ${bicycle.title}`,
            metadata: {
                bicycleId,
                inspectionReportId: report._id
            }
        });

        res.status(200).json({
            success: true,
            message: 'Phân công kiểm định viên thành công',
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

// DELETE /admin/bicycles/:bicycleId/unassign-inspector - Unassign inspector
export const unassignInspector = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { bicycleId } = req.params;

        const bicycle = await Bicycle.findById(bicycleId);
        if (!bicycle) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy xe đạp'
            });
            return;
        }

        if (bicycle.inspectionStatus === 'IN_PROGRESS') {
            res.status(400).json({
                success: false,
                message: 'Không thể bỏ phân công khi quá trình kiểm định đang thực hiện'
            });
            return;
        }

        if (bicycle.inspectionStatus === 'COMPLETED') {
            res.status(400).json({
                success: false,
                message: 'Không thể bỏ phân công kiểm định đã hoàn thành'
            });
            return;
        }

        // Delete pending inspection report
        await InspectionReport.deleteOne({
            bicycleId,
            status: 'ASSIGNED'
        });

        // Reset bicycle inspection status
        bicycle.inspectionStatus = 'PENDING';
        bicycle.assignedInspectorId = undefined;
        await bicycle.save();

        res.status(200).json({
            success: true,
            message: 'Inspector unassigned successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// GET /admin/inspection-reports - Get all inspection reports
export const getAllInspectionReports = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { status } = req.query;
        const query: any = {};

        if (status) {
            query.status = status;
        }

        const reports = await InspectionReport.find(query)
            .populate('bicycleId', 'title images')
            .populate('inspectorId', 'fullName email')
            .populate('assignedBy', 'fullName')
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
