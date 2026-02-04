import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';

//Firebase 
const { auth } = require('../config/firebase');

//Verify Firebase token
export const verifyToken = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer')) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
            return;
        }

        const token = authHeader.split('Bearer ')[1];

        const decodedToken = await auth.verifyIdToken(token);

        req.firebaseUser = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            name: decodedToken.name,
            picture: decodedToken.picture,
        };

        const user = await User.findOne({ firebaseUId: decodedToken.uid });

        if (user) {
            req.user = user;
        }

        next();
    } catch (error) {
        console.error('Auth error: ', error);
        res.status(401).json({
            success: false,
            message: 'Token is not valid',
        });
    }
};

//User must register
export const requireUser = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'User does not register with system',
        });
        return;
    }
    next();
}

// Require Admin role
export const requireAdmin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'User does not register with system',
        });
        return;
    }

    if (!req.user.roles.includes('ADMIN')) {
        res.status(403).json({
            success: false,
            message: 'Access denied. Admin role required.',
        });
        return;
    }
    next();
}

// Require Inspector role
export const requireInspector = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.user) {
        res.status(401).json({
            success: false,
            message: 'User does not register with system',
        });
        return;
    }

    if (!req.user.roles.includes('INSPECTOR')) {
        res.status(403).json({
            success: false,
            message: 'Access denied. Inspector role required.',
        });
        return;
    }
    next();
}
