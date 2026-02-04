import { Router } from 'express';
import {
    createInspector,
    getAllInspectors,
    getInspectorById,
    updateInspector,
    deleteInspector,
    assignInspector,
    unassignInspector,
    getAllInspectionReports
} from '../../controllers/admin/inspectorController';
import { verifyToken, requireAdmin } from '../../middleware/auth';

const router = Router();

// All routes require admin authentication
router.use(verifyToken, requireAdmin);

// Inspector management
router.post('/inspectors', createInspector);
router.get('/inspectors', getAllInspectors);
router.get('/inspectors/:id', getInspectorById);
router.patch('/inspectors/:id', updateInspector);
router.delete('/inspectors/:id', deleteInspector);

// Assignment
router.post('/bicycles/:bicycleId/assign-inspector', assignInspector);
router.delete('/bicycles/:bicycleId/unassign-inspector', unassignInspector);

// Reports
router.get('/inspection-reports', getAllInspectionReports);

export default router;
