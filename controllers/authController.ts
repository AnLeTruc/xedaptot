import { Response } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';
import { generateVerificationToken, generateTokenExpiry } from '../utils/tokenUtils';
import { sendVerificationEmail } from '../service/emailService';

const { auth } = require('../config/firebase');

//Send verification mail
export const sendEmailVerification = async (
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

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'User not found'
            });

            return;
        }

        //Checking verify
        if (user.isVerified) {
            res.status(400).json({
                success: false,
                message: 'Email already verified'
            });

            return;
        }

        //Create token
        const token = generateVerificationToken();
        const expires = generateTokenExpiry();

        //Update user
        user.emailVerificationToken = token;
        user.emailVerificationExpires = expires;
        await user.save();

        //Send mail
        const emailSent = await sendVerificationEmail(
            user.email,
            token,
            user.fullName || ''
        );

        if (!emailSent) {
            res.status(500).json({
                success: false,
                message: 'Failed to send verification email'
            });

            return;
        }

        res.status(200).json({
            success: true,
            message: 'Verification email sent successfully'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Failed to send verification email'
        });
    }
};

//Verify Email
export const verifyEmail = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { token } = req.query;

        if (!token || typeof token !== 'string') {
            res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });
            return;
        }

        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: new Date() }
        }).select(
            '+emailVerificationToken +emailVerificationExpires'
        );

        if (!user) {
            res.status(400).json({
                success: false,
                message: 'Invalid verification token'
            });

            return;
        }

        //Update user
        user.isVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;

        await user.save();

        res.status(200).json({
            success: true,  // << SỬA: phải là true, không phải false
            message: 'Email verified successfully'
        });
    } catch (error: any) {
        console.error('Verify email error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to verify email'
        });
    }
};

// Helper: Map Firebase provider
const mapFirebaseProvider = (signInProvider: string): 'google' | 'email' | 'facebook' => {
    switch (signInProvider) {
        case 'google.com':
            return 'google';
        case 'password':
        default:
            return 'email';
    }
};

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

        const signInProvider = decodedToken.firebase?.sign_in_provider || 'password';
        const authProvider = mapFirebaseProvider(signInProvider);

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            if (existingUser.firebaseUId !== uid) {
                res.status(400).json({
                    success: false,
                    message: `Email already registered with ${existingUser.authProvider}. Please use ${existingUser.authProvider} to login.`
                });
                return;
            }
            existingUser.fullName = name || existingUser.fullName;
            existingUser.avatarUrl = picture || existingUser.avatarUrl;
            await existingUser.save();

            res.status(200).json({
                success: true,
                message: 'User logged in successfully',
                data: {
                    id: existingUser._id,
                    email: existingUser.email,
                    fullName: existingUser.fullName,
                    avatarUrl: existingUser.avatarUrl,
                    roles: existingUser.roles,
                    isVerified: existingUser.isVerified,
                    authProvider: existingUser.authProvider
                },
            });
            return;
        }

        const newUser = await User.create({
            firebaseUId: uid,
            email: email || '',
            fullName: name || '',
            avatarUrl: picture || '',
            roles: ['BUYER'],
            reputationScore: 0,
            isVerified: false,
            isActive: true,
            authProvider
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: newUser._id,
                email: newUser.email,
                fullName: newUser.fullName,
                avatarUrl: newUser.avatarUrl,
                roles: newUser.roles,
                isVerified: newUser.isVerified,
                authProvider: newUser.authProvider
            },
        });
    } catch (error: any) {
        console.error('Firebase auth error:', error);
        res.status(401).json({
            success: false,
            message: 'Authorization failed'
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

// Firebase REST API base URL
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_AUTH_URL = 'https://identitytoolkit.googleapis.com/v1/accounts';

// Email Register 
export const emailRegister = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { email, password, fullName } = req.body;

        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: `Email already registered with ${existingUser.authProvider}. Please use ${existingUser.authProvider} to login.`
            });
            return;
        }

        const response = await fetch(`${FIREBASE_AUTH_URL}:signUp?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
        });

        const data: any = await response.json();

        if (!response.ok) {
            res.status(400).json({
                success: false,
                message: data.error?.message || 'Failed to create account'
            });
            return;
        }

        const newUser = await User.create({
            firebaseUId: data.localId,
            email: email,
            fullName: fullName || '',
            roles: ['BUYER'],
            reputationScore: 0,
            isVerified: false,
            isActive: true,
            authProvider: 'email'
        });

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                id: newUser._id,
                email: newUser.email,
                fullName: newUser.fullName,
                roles: newUser.roles,
                authProvider: newUser.authProvider,
                idToken: data.idToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn
            }
        });
    } catch (error: any) {
        console.error('Email register error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Registration failed'
        });
    }
};

// Email Login
export const emailLogin = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.authProvider !== 'email') {
            res.status(400).json({
                success: false,
                message: `This email is registered with ${existingUser.authProvider}. Please use ${existingUser.authProvider} to login.`
            });
            return;
        }

        const response = await fetch(`${FIREBASE_AUTH_URL}:signInWithPassword?key=${FIREBASE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                returnSecureToken: true
            })
        });

        const data: any = await response.json();

        if (!response.ok) {
            const errorMessage = data.error?.message === 'INVALID_LOGIN_CREDENTIALS'
                ? 'Invalid email or password'
                : data.error?.message || 'Login failed';

            res.status(401).json({
                success: false,
                message: errorMessage
            });
            return;
        }

        const user = await User.findOne({ firebaseUId: data.localId });

        res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                id: user?._id,
                email: data.email,
                fullName: user?.fullName,
                roles: user?.roles,
                authProvider: user?.authProvider,
                idToken: data.idToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn
            }
        });
    } catch (error: any) {
        console.error('Email login error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Login failed'
        });
    }
};

//Refresh Token
export const refreshToken = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
            return;
        }

        //Firebase exchange refresh token
        const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken
                })
            }
        );

        const data: any = await response.json();

        if (!response.ok) {
            res.status(401).json({
                success: false,
                message: data.error?.message || 'Failed to refresh token'
            });
            return;
        }

        //Return new token
        res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                idToken: data.id_token,
                refreshToken: data.refresh_token,
                expiresIn: data.expires_in,
                userId: data.user_id
            }
        });
    } catch (error: any) {
        console.error('Refresh token error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to refresh token'
        });
    }
};

