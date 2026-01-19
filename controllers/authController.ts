import { Response } from 'express';
import { AuthRequest } from '../types/index.js';
import User from '../models/User.js';

const { auth } = require('../config/firebase');

//Register/Sign in with firebase
export const firebaseAuth = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
            return;
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        const { uid, email, name, picture } = decodedToken;

        const user = await User.findOneAndUpdate(
            {
                firebaseUId: uid
            },
            {
                $set: {
                    email: email || '',
                    fullName: name || '',
                    avatarUrl: picture || '',
                },

                $setOnInsert: {
                    firebaseUId: uid,
                    roles: ['BUYER'],
                    reputationScore: 0,
                    isVerified: false,
                    isActive: true,
                },
            },
            {
                upsert: true,
                new: true,
                runValidators: true
            }
        );

        res.status(200).json({
            success: true,
            message: user.createdAt.getTime() === user.updatedAt.getTime()
                ? 'User registered successfully'
                : 'User updated successfully',
            data: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                roles: user.roles,
                isVerified: user.isVerified,
            },
        });
    } catch (error: any) {
        console.error('Firebase auth error:', error);
        res.status(401).json({
            success: false,
            message: 'authorization failed'
        });
    }
};
