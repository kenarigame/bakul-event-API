import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();
const ctrl = new DashboardController();

router.get('/customer', authenticate, authorize('CUSTOMER'), ctrl.getCustomerDashboard.bind(ctrl));
router.get('/organizer', authenticate, authorize('ORGANIZER'), ctrl.getOrganizerDashboard.bind(ctrl));
router.get('/admin', authenticate, authorize('ADMIN'), ctrl.getAdminDashboard.bind(ctrl));
router.get('/points', authenticate, ctrl.getUserPoints.bind(ctrl));

export default router;
