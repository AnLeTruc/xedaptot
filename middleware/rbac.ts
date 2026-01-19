import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types/index.js';

export const requireRole = (...allowedRoles: UserRole[]) => {
    return (
        req: AuthRequest,
        res: Response,
        next: NextFunction
    ): void => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
            return;
        }

        const userRoles = req.user.roles;

        const hasPermission = allowedRoles.some(role => userRoles.includes(role));

        if (!hasPermission) {
            res.status(403).json({
                success: false,
                message: 'Forbidden',
                currentRoles: userRoles
            });
            return;
        }

        //Has permission
        next();
    }
}

export const requireSeller = requireRole('SELLER', 'ADMIN');
export const requireAdmin = requireRole('ADMIN');
export const requireInspector = requireRole('INSPECTOR');