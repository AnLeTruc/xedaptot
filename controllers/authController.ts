import { Response } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';

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




export const getProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const user = req.user;

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'User not found'
            })
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                email: user.email,
                fullName: user.fullName,
                phone: user.phone,
                address: user.address,
                avatarUrl: user.avatarUrl,
                roles: user.roles,
                reputationScore: user.reputationScore,
                isVerified: user.isVerified,
                createdAt: user.createdAt
            }
        })
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        })
    }
}


export const updateProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
            return;
        }

        const { fullName, phone, avatarUrl, address } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { fullName, phone, avatarUrl, address },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                email: updatedUser.email,
                fullName: updatedUser.fullName,
                phone: updatedUser.phone,
                address: updatedUser.address,
                avatarUrl: updatedUser.avatarUrl,
                roles: updatedUser.roles,
                reputationScore: updatedUser.reputationScore,
                isVerified: updatedUser.isVerified,
                createdAt: updatedUser.createdAt
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};