import { Router } from 'express';
import {
    getMyProfile,
    getBicycles,
    claimBicycle,
    getMyReports,
    submitReport,
    getReportById,
    getNotifications,
    markNotificationRead
} from '../controllers/inspectorController';
import { verifyToken, requireInspector } from '../middleware/auth';

const router = Router();

// All routes require inspector authentication
router.use(verifyToken, requireInspector);

// Profile
router.get('/me', getMyProfile);

// Bicycles
router.get('/bicycles', getBicycles);
router.post('/bicycles/:id/claim', claimBicycle);

// Reports
router.get('/reports', getMyReports);
router.post('/reports', submitReport);
router.get('/reports/:id', getReportById);

// Notifications
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

export default router;
