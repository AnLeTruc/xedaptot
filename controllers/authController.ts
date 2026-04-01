import { Response } from 'express';
import { AuthRequest } from '../types';
import User from '../models/User';
import Package from '../models/Package';
import UserPackage from '../models/UserPackage';
import { generateVerificationToken, generateTokenExpiry } from '../utils/tokenUtils';
import { sendMail, sendVerificationEmail, sendPasswordChangedEmail } from '../services/emailService';
import { generate6DigitCode, hashResetCode, hashResetToken, timingSafeEqualHex } from '../utils/passwordReset';
import * as shippingService from '../services/shippingService';
import * as notificationService from '../services/notificationService';
import { buildFullAddress } from '../utils/address';
import crypto from 'crypto';
import { encryptSensitive, maskSensitive } from '../utils/sensitiveData';

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
                message: 'Người dùng chưa xác thực'
            });

            return;
        }

        const user = await User.findById(userId);

        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });

            return;
        }

        //Checking verify
        if (user.isVerified) {
            res.status(400).json({
                success: false,
                message: 'Email đã được xác thực'
            });

            return;
        }

        //Create token
        const token = generateVerificationToken();
        const expires = generateTokenExpiry();

        //Update user
        await User.findByIdAndUpdate(userId, {
            emailVerificationToken: token,
            emailVerificationExpires: expires
        });

        //Send mail
        const emailSent = await sendVerificationEmail(
            user.email,
            token,
            user.fullName || ''
        );

        if (!emailSent) {
            res.status(500).json({
                success: false,
                message: 'Gửi email xác thực thất bại'
            });

            return;
        }

        res.status(200).json({
            success: true,
            message: 'Email xác thực đã được gửi thành công'
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: 'Gửi email xác thực thất bại'
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
                message: 'Token xác thực không hợp lệ'
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
                message: 'Token xác thực không hợp lệ hoặc đã hết hạn'
            });

            return;
        }

        //Update user
        await User.findByIdAndUpdate(user._id, {
            isVerified: true,
            $unset: {
                emailVerificationToken: 1,
                emailVerificationExpires: 1
            }
        });
        //Noti email verified success
        notificationService.notifyEmailVerified(user._id.toString());

        res.status(200).json({
            success: true,
            message: 'Xác thực email thành công'
        });
    } catch (error: any) {
        console.error('Verify email error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Xác thực email thất bại'
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

//Helper: Assign free package to new user
const assignFreePackage = async (userId: any): Promise<void> => {
    try {
        const freePackage = await Package.findOne({ code: 'FREE' });
        if (!freePackage) return;
        await UserPackage.create({
            userId,
            packageId: freePackage._id,
            package: {
                _id: freePackage._id,
                name: freePackage.name,
                code: freePackage.code,
                postLimit: freePackage.postLimit,
            },
            postedUsed: 0,
            postRemaining: freePackage.postLimit,
            status: 'ACTIVE',
            purchasedAt: new Date(),
        });
    } catch (_) {
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
                message: 'Chưa xác thực'
            });
            return;
        }

        let token = authHeader.slice('Bearer '.length).trim();

        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Chưa xác thực'
            });
            return;
        }

        let decodedToken: any;
        try {
            decodedToken = await auth.verifyIdToken(token);
        } catch (error: any) {
            const code = error?.code || error?.errorInfo?.code;

            if (code === 'auth/id-token-expired') {
                const providedRefreshToken = req.body?.refreshToken;

                if (providedRefreshToken && process.env.FIREBASE_API_KEY) {
                    const refreshResponse = await fetch(
                        `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                grant_type: 'refresh_token',
                                refresh_token: providedRefreshToken,
                            }),
                        }
                    );

                    const refreshData: any = await refreshResponse.json();
                    if (refreshResponse.ok && refreshData?.id_token) {
                        token = refreshData.id_token;
                        decodedToken = await auth.verifyIdToken(token);
                    } else {
                        res.status(401).json({
                            success: false,
                            code: 'auth/id-token-expired',
                            message: 'Token đã hết hạn. Vui lòng làm mới token và thử lại.',
                        });
                        return;
                    }
                } else {
                    res.status(401).json({
                        success: false,
                        code: 'auth/id-token-expired',
                        message: 'Token đã hết hạn. Vui lòng làm mới token và thử lại.',
                    });
                    return;
                }
            } else {
                throw error;
            }
        }

        const uid = decodedToken.uid as string;
        let email = decodedToken.email as string | undefined;
        let name = decodedToken.name as string | undefined;
        let picture = decodedToken.picture as string | undefined;

        if (!email) {
            try {
                const userRecord = await auth.getUser(uid);
                email = userRecord.email || email;
                name = name || userRecord.displayName || undefined;
                picture = picture || userRecord.photoURL || undefined;
            } catch (_) {
            }
        }

        if (!email) {
            console.warn('[Auth][Firebase] Missing email in token/userRecord', {
                uid,
                signInProvider: decodedToken.firebase?.sign_in_provider,
                hasEmailInToken: Boolean(decodedToken.email),
            });
            res.status(400).json({
                success: false,
                code: 'auth/missing-email',
                message: 'Không lấy được email từ tài khoản Google/Firebase. Vui lòng cấp quyền email hoặc dùng phương thức đăng nhập khác.',
            });
            return;
        }

        const signInProvider = decodedToken.firebase?.sign_in_provider || 'password';
        const authProvider = mapFirebaseProvider(signInProvider);

        const existingUser = await User.findOne({ email });

        // Have user with same mail
        if (existingUser) {
            // Block deactivated users
            if (!existingUser.isActive) {
                res.status(401).json({
                    success: false,
                    message: 'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.',
                    isDeactivated: true
                });
                return;
            }

            if (existingUser.authProvider !== authProvider) {
                console.warn('[Auth][Firebase] Provider mismatch for email', {
                    uid,
                    existingAuthProvider: existingUser.authProvider,
                    requestAuthProvider: authProvider,
                });

                // Best-effort: If the Firebase user has a linked provider that conflicts with
                // the system record, attempt to unlink to avoid future confusion.
                try {
                    const firebaseUser = await auth.getUser(uid);
                    const linkedProviders = firebaseUser.providerData.map((p: any) => p.providerId);

                    if (linkedProviders.includes('google.com') && existingUser.authProvider === 'email') {
                        await auth.updateUser(uid, {
                            providersToUnlink: ['google.com']
                        });
                    }
                } catch (e) {
                    console.warn('[Auth][Firebase] Best-effort provider unlink failed', {
                        uid,
                        code: (e as any)?.code || (e as any)?.errorInfo?.code,
                        message: (e as any)?.message,
                    });
                }

                res.status(400).json({
                    success: false,
                    code: 'auth/provider-mismatch',
                    message: `Email đã đăng ký với ${existingUser.authProvider}.`
                });
                return;
            }
            if (existingUser.firebaseUId !== uid) {
                res.status(400).json({
                    success: false,
                    code: 'auth/account-mismatch',
                    message: `Email đã đăng ký với ${existingUser.authProvider}. Vui lòng sử dụng đúng tài khoản để đăng nhập.`
                });
                return;
            }

            const customToken = await auth.createCustomToken(uid);
            const tokenResponse = await fetch(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
                }
            );
            const tokenData: any = await tokenResponse.json();
            if (!tokenResponse.ok) {
                res.status(500).json({
                    success: false,
                    message: 'Không thể tạo phiên đăng nhập'
                });
                return;
            }
            existingUser.fullName = name || existingUser.fullName;
            existingUser.avatarUrl = picture || existingUser.avatarUrl;
            // If user signs in with Google, mark email as verified
            if (authProvider === 'google' && !existingUser.isVerified) {
                existingUser.isVerified = true;
            }
            await existingUser.save();
            //Noti login success
            notificationService.notifyLoggedIn(existingUser._id.toString());

            res.status(200).json({
                success: true,
                message: 'Đăng nhập thành công',
                data: {
                    id: existingUser._id,
                    email: existingUser.email,
                    fullName: existingUser.fullName,
                    avatarUrl: existingUser.avatarUrl,
                    roles: existingUser.roles,
                    isVerified: existingUser.isVerified,
                    authProvider: existingUser.authProvider,
                    idToken: tokenData.idToken,
                    refreshToken: tokenData.refreshToken,
                    expiresIn: tokenData.expiresIn,
                },
            });
            return;
        }

        //Create
        const customToken = await auth.createCustomToken(uid);
        const tokenResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: customToken, returnSecureToken: true }),
            }
        );
        const tokenData: any = await tokenResponse.json();
        if (!tokenResponse.ok) {
            res.status(500).json({
                success: false,
                message: 'Không thể tạo phiên đăng nhập'
            });
            return;
        }
        const newUser = await User.create({
            firebaseUId: uid,
            email,
            fullName: name || '',
            avatarUrl: picture || '',
            roles: ['BUYER'],
            reputationScore: 0,
            // auto-verify when registering via Google
            isVerified: authProvider === 'google',
            isActive: true,
            authProvider
        });
        await assignFreePackage(newUser._id);
        //Noti create google success
        notificationService.notifyRegistered(newUser._id.toString());

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công',
            data: {
                id: newUser._id,
                email: newUser.email,
                fullName: newUser.fullName,
                avatarUrl: newUser.avatarUrl,
                roles: newUser.roles,
                isVerified: newUser.isVerified,
                authProvider: newUser.authProvider,
                idToken: tokenData.idToken,
                refreshToken: tokenData.refreshToken,
                expiresIn: tokenData.expiresIn,
            },
        });
    } catch (error: any) {
        console.error('Firebase auth error:', error);
        const code = error?.code || error?.errorInfo?.code;
        if (code === 'auth/id-token-expired') {
            res.status(401).json({
                success: false,
                code: 'auth/id-token-expired',
                message: 'Token đã hết hạn. Vui lòng làm mới token và thử lại.',
            });
            return;
        }

        res.status(401).json({
            success: false,
            message: 'Xác thực thất bại'
        });
    }
};

// Public profile — no auth required
export const getPublicProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        const user = await User.findById(id).select(
            'fullName avatarUrl reputationScore createdAt isActive'
        );

        if (!user || !user.isActive) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng',
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                reputationScore: user.reputationScore,
                createdAt: user.createdAt,
            },
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message,
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
                message: 'Không tìm thấy người dùng'
            })
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                email: user.email,
                fullName: user.fullName,
                phone: user.phone,
                gender: user.gender,
                dateOfBirth: user.dateOfBirth,
                addresses: user.addresses,
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

//Update profile
export const updateProfile = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Người dùng chưa xác thực'
            });
            return;
        }

        const { fullName, phone, avatarUrl, addresses, gender, dateOfBirth } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { fullName, phone, avatarUrl, addresses, gender, dateOfBirth },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật hồ sơ thành công',
            data: {
                email: updatedUser.email,
                fullName: updatedUser.fullName,
                phone: updatedUser.phone,
                gender: updatedUser.gender,
                dateOfBirth: updatedUser.dateOfBirth,
                addresses: updatedUser.addresses,
                avatarUrl: updatedUser.avatarUrl,
                roles: updatedUser.roles,
                reputationScore: updatedUser.reputationScore,
                isVerified: updatedUser.isVerified,
                createdAt: updatedUser.createdAt
            }
        });

        //Noti change profile
        notificationService.notifyProfileUpdated(userId.toString());
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Cập nhật hồ sơ thất bại'
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
                message: 'Email và mật khẩu là bắt buộc'
            });
            return;
        }

        if (password.length < 6) {
            res.status(400).json({
                success: false,
                message: 'Mật khẩu phải có ít nhất 6 ký tự'
            });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({
                success: false,
                message: `Email đã được đăng ký với ${existingUser.authProvider}. Vui lòng sử dụng ${existingUser.authProvider} để đăng nhập.`
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
                message: data.error?.message || 'Tạo tài khoản thất bại'
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

        await assignFreePackage(newUser._id);
        //Noti register success
        notificationService.notifyRegistered(newUser._id.toString());

        res.status(201).json({
            success: true,
            message: 'Đăng ký thành công',
            data: {
                id: newUser._id,
                email: newUser.email,
                fullName: newUser.fullName,
                avatarUrl: newUser.avatarUrl,
                roles: newUser.roles,
                authProvider: newUser.authProvider,
                isVerified: newUser.isVerified,
                idToken: data.idToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn
            }
        });
    } catch (error: any) {
        console.error('Email register error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Đăng ký thất bại'
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
                message: 'Email và mật khẩu là bắt buộc'
            });
            return;
        }

        const existingUser = await User.findOne({ email });
        if (existingUser && existingUser.authProvider !== 'email') {
            res.status(400).json({
                success: false,
                message: `Email này đã đăng ký với ${existingUser.authProvider}. Vui lòng sử dụng ${existingUser.authProvider} để đăng nhập.`
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
            if (data.error?.message === 'INVALID_LOGIN_CREDENTIALS') {
                const dbUser = await User.findOne({ email });
                if (dbUser) {
                    try {
                        const firebaseUser = await auth.getUserByEmail(email);
                        const linkedProviders = firebaseUser.providerData.map((p: any) => p.providerId);

                        if (linkedProviders.includes('google.com') && !linkedProviders.includes('password')) {
                            res.status(401).json({
                                success: false,
                                message: 'Tài khoản của bạn đã bị ảnh hưởng bởi đăng nhập Google. Vui lòng đặt lại mật khẩu.'
                            });
                            return;
                        }
                    } catch (_) { }
                }

                res.status(401).json({
                    success: false,
                    message: 'Email hoặc mật khẩu không chính xác'
                });
                return;
            }

            res.status(401).json({
                success: false,
                message: data.error?.message || 'Đăng nhập thất bại'
            });
            return;
        }

        const user = await User.findOne({ firebaseUId: data.localId });

        // Block deactivated users
        if (user && !user.isActive) {
            res.status(401).json({
                success: false,
                message: 'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.',
                isDeactivated: true
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Đăng nhập thành công',
            data: {
                id: user?._id,
                email: data.email,
                fullName: user?.fullName,
                avatarUrl: user?.avatarUrl,
                roles: user?.roles,
                authProvider: user?.authProvider,
                isVerified: user?.isVerified,
                idToken: data.idToken,
                refreshToken: data.refreshToken,
                expiresIn: data.expiresIn
            }
        });
    } catch (error: any) {
        console.error('Email login error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Đăng nhập thất bại'
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
                message: 'Refresh token là bắt buộc'
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
                message: data.error?.message || 'Làm mới token thất bại'
            });
            return;
        }

        // Block deactivated users from refreshing token
        const user = await User.findOne({ firebaseUId: data.user_id });
        if (user && !user.isActive) {
            res.status(401).json({
                success: false,
                message: 'Tài khoản đã bị vô hiệu hoá. Vui lòng liên hệ quản trị viên.',
                isDeactivated: true
            });
            return;
        }

        //Return new token
        res.status(200).json({
            success: true,
            message: 'Làm mới token thành công',
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
            message: error.message || 'Làm mới token thất bại'
        });
    }
};

export const addAddress = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Chưa xác thực'
            });
            return;
        }

        const { label, fullName, phone, provinceId, districtId, wardCode, street, coordinates, isDefault } = req.body;

        const resolvedLocation = await shippingService.resolveGhnLocationNames(
            provinceId,
            districtId,
            wardCode
        );
        if (!resolvedLocation) {
            res.status(400).json({
                success: false,
                message: 'Dữ liệu địa chỉ GHN không hợp lệ'
            });
            return;
        }

        const addressData = {
            label,
            fullName,
            phone,
            provinceId,
            districtId,
            wardCode,
            provinceName: resolvedLocation.provinceName,
            districtName: resolvedLocation.districtName,
            wardName: resolvedLocation.wardName,
            street,
            fullAddress: buildFullAddress({
                street,
                wardName: resolvedLocation.wardName,
                districtName: resolvedLocation.districtName,
                provinceName: resolvedLocation.provinceName
            }),
            coordinates,
            isDefault: isDefault || false
        };

        if (isDefault) {
            const user = await User.findById(userId);

            if (user?.addresses && user.addresses.length > 0) {
                await User.updateOne(
                    { _id: userId },
                    { $set: { 'addresses.$[].isDefault': false } }
                );
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $push: { addresses: addressData } },
            { new: true }
        );
        res.status(201).json({
            success: true,
            message: 'Thêm địa chỉ thành công',
            data: updatedUser?.addresses
        })

        //Noti add address
        notificationService.notifyAddressAdded(userId.toString());

    } catch (error: any) {
        console.error('Add address error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Thêm địa chỉ thất bại'
        });
    }
};

export const updateAddress = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Chưa xác thực'
            })
            return;
        }

        const { label, fullName, phone, street, provinceId, districtId, wardCode, coordinates } = req.body;

        const updates: Record<string, any> = {};
        if (label !== undefined) updates['addresses.$.label'] = label;
        if (fullName !== undefined) updates['addresses.$.fullName'] = fullName;
        if (phone !== undefined) updates['addresses.$.phone'] = phone;
        if (street !== undefined) updates['addresses.$.street'] = street;
        if (coordinates !== undefined) updates['addresses.$.coordinates'] = coordinates;

        const hasGhnChange = provinceId !== undefined || districtId !== undefined || wardCode !== undefined;

        if (hasGhnChange) {
            const user = await User.findOne({ _id: userId, 'addresses._id': id });
            const existingAddr = user?.addresses?.find((a: any) => a._id.toString() === id);
            if (!existingAddr) {
                res.status(404).json({ success: false, message: 'Không tìm thấy địa chỉ' });
                return;
            }

            const finalProvinceId = provinceId ?? existingAddr.provinceId;
            const finalDistrictId = districtId ?? existingAddr.districtId;
            const finalWardCode = wardCode ?? existingAddr.wardCode;

            const resolvedLocation = await shippingService.resolveGhnLocationNames(
                finalProvinceId,
                finalDistrictId,
                finalWardCode
            );
            if (!resolvedLocation) {
                res.status(400).json({ success: false, message: 'Dữ liệu địa chỉ GHN không hợp lệ' });
                return;
            }

            updates['addresses.$.provinceId'] = finalProvinceId;
            updates['addresses.$.districtId'] = finalDistrictId;
            updates['addresses.$.wardCode'] = finalWardCode;
            updates['addresses.$.provinceName'] = resolvedLocation.provinceName;
            updates['addresses.$.districtName'] = resolvedLocation.districtName;
            updates['addresses.$.wardName'] = resolvedLocation.wardName;

            const finalStreet = street !== undefined ? street : existingAddr.street;
            updates['addresses.$.fullAddress'] = buildFullAddress({
                street: finalStreet,
                wardName: resolvedLocation.wardName,
                districtName: resolvedLocation.districtName,
                provinceName: resolvedLocation.provinceName
            });
        } else if (street !== undefined) {
            const user = await User.findOne({ _id: userId, 'addresses._id': id });
            const existingAddr = user?.addresses?.find((a: any) => a._id.toString() === id);
            if (existingAddr) {
                updates['addresses.$.fullAddress'] = buildFullAddress({
                    street,
                    wardName: existingAddr.wardName,
                    districtName: existingAddr.districtName,
                    provinceName: existingAddr.provinceName
                });
            }
        }

        if (Object.keys(updates).length === 0) {
            res.status(400).json({
                success: false,
                message: 'Không có trường nào để cập nhật'
            });
            return;
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, 'addresses._id': id },
            { $set: updates },
            { new: true }
        );

        if (!updatedUser) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy địa chỉ'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Cập nhật địa chỉ thành công',
            data: updatedUser?.addresses
        })

        //Noti update address
        notificationService.notifyAddressUpdated(userId.toString());
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Cập nhật địa chỉ thất bại'
        })
    }
}

// DELETE /api/auth/addresses/:id
export const deleteAddress = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        const { id } = req.params;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Người dùng chưa xác thực'
            });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
            return;
        }

        const addressToDelete = user.addresses?.find(
            (addr: any) => addr._id.toString() === id
        );

        if (!addressToDelete) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy địa chỉ'
            });
            return;
        }

        await User.findByIdAndUpdate(userId, {
            $pull: {
                addresses: { _id: id }
            }
        });

        if (addressToDelete.isDefault) {
            await User.updateOne(
                { _id: userId, 'addresses.0': { $exists: true } },
                { $set: { 'addresses.0.isDefault': true } }
            );
        }

        const updatedUser = await User.findById(userId);

        res.status(200).json({
            success: true,
            message: 'Xoá địa chỉ thành công',
            data: updatedUser?.addresses
        });

        //Noti delete address
        notificationService.notifyAddressDeleted(userId.toString());


    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Xoá địa chỉ thất bại'
        })
    }
}

// PUT /api/auth/addresses/:id/default - Đặt làm mặc định
export const setDefaultAddress = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        const { id } = req.params;
        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Người dùng chưa xác thực'
            });
            return;
        }

        const { fullName, phone } = req.body || {};

        await User.updateOne(
            { _id: userId },
            { $set: { 'addresses.$[].isDefault': false } }
        );

        const setFields: Record<string, any> = { 'addresses.$.isDefault': true };
        if (fullName !== undefined) setFields['addresses.$.fullName'] = fullName;
        if (phone !== undefined) setFields['addresses.$.phone'] = phone;

        const updatedUser = await User.findOneAndUpdate(
            { _id: userId, 'addresses._id': id },
            { $set: setFields },
            { new: true }
        );
        if (!updatedUser) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy địa chỉ'
            });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Đặt địa chỉ mặc định thành công',
            data: updatedUser.addresses
        });

    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Đặt địa chỉ mặc định thất bại'
        })
    }
}

//Send code reset password to mail
export const forgotPassword = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    const { email } = req.body;

    if (!email) {
        res.status(400).json({
            success: false,
            message: 'Email là bắt buộc'
        })
        return;
    };

    const genericOk = () =>
        res.status(200).json({
            success: true,
            message: 'Nếu email này có trong hệ thống, mã đặt lại mật khẩu đã được gửi.'
        });

    const user = await User.findOne({
        email: String(email).toLowerCase()
    })
        .select('+passwordResetCodeHash +passwordResetExpires +passwordResetAttempts');

    if (!user) {
        genericOk();
        return;
    }
    if (user.authProvider !== 'email') {
        genericOk();
        return;
    }

    const code = generate6DigitCode();

    await User.findByIdAndUpdate(user._id, {
        passwordResetCodeHash: hashResetCode(email, code),
        passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000), //10 minutes
        passwordResetAttempts: 0,
        $unset: {
            passwordResetVerifiedAt: 1,
            passwordResetTokenHash: 1,
            passwordResetTokenExpires: 1
        }
    });
    //Noti forgot pass
    notificationService.notifyForgotPassword(user._id.toString());

    await sendMail({
        to: user.email,
        subject: '[Xedaptot] Password reset code',
        html: `
            <p>Your password reset code is:</p>
            <h2>${code}</h2>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn’t request this, ignore this email.</p>
        `
    });

    genericOk();
    return;
};

//Verify reset token
export const verifyResetCode = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    const { email, code } = req.body;

    if (!email || !code) {
        res.status(400).json({
            success: false,
            message: 'Email và mã xác nhận là bắt buộc'
        })
        return;
    };

    const user = await User.findOne({
        email: String(email).toLowerCase()
    })
        .select('+passwordResetCodeHash +passwordResetExpires +passwordResetAttempts +passwordResetVerifiedAt');

    if (!user || user.authProvider !== 'email') {
        res.status(400).json({
            success: false,
            message: 'Mã không hợp lệ'
        });
        return;
    };

    if (!user.passwordResetCodeHash || !user.passwordResetExpires) {
        res.status(400).json({
            success: false,
            message: 'Không tìm thấy mã đặt lại. Vui lòng yêu cầu mã mới.'
        })
        return;
    };

    if (user.passwordResetExpires.getTime() <= Date.now()) {
        res.status(400).json({
            success: false,
            message: 'Mã đặt lại đã hết hạn. Vui lòng yêu cầu mã mới.'
        })
        return;
    };

    const maxAttempts = 5;
    if ((user.passwordResetAttempts ?? 0) >= maxAttempts) {
        res.status(429).json({
            success: false,
            message: 'Đã vượt quá số lần thử cho phép. Vui lòng yêu cầu mã mới.'
        })
        return;
    };

    const inputHash = hashResetCode(user.email, String(code));
    const ok = timingSafeEqualHex(user.passwordResetCodeHash, inputHash);

    if (!ok) {
        await User.findByIdAndUpdate(user._id, {
            $inc: { passwordResetAttempts: 1 }
        });
        res.status(400).json({
            success: false,
            message: 'Mã không hợp lệ'
        })
        return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(user._id, {
        passwordResetVerifiedAt: new Date(),
        passwordResetTokenHash: hashResetToken(resetToken),
        passwordResetTokenExpires: new Date(Date.now() + 10 * 60 * 1000),
        $inc: { passwordResetAttempts: 1 }
    });

    res.status(200).json({
        success: true,
        message: 'Xác thực mã thành công',
        data: { resetToken }
    })

    return;
};

//Reset password
export const resetPassword = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
        res.status(400).json({
            success: false,
            message: 'Email, mã đặt lại và mật khẩu mới là bắt buộc'
        })
        return;
    };

    if (String(newPassword).length < 6) {
        res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
        return;
    };

    const user = await User.findOne({ email: String(email).toLowerCase() })
        .select('+passwordResetTokenHash +passwordResetTokenExpires');

    if (!user || user.authProvider !== 'email') {
        res.status(400).json({ success: false, message: 'Token đặt lại không hợp lệ' });
        return;
    }

    if (!user.passwordResetTokenHash || !user.passwordResetTokenExpires) {
        res.status(400).json({ success: false, message: 'Token đặt lại không hợp lệ' });
        return;
    }

    if (user.passwordResetTokenExpires.getTime() <= Date.now()) {
        res.status(400).json({ success: false, message: 'Token đặt lại đã hết hạn' });
        return;
    }

    const inputHash = hashResetToken(String(resetToken));
    if (!timingSafeEqualHex(user.passwordResetTokenHash, inputHash)) {
        res.status(400).json({ success: false, message: 'Token đặt lại không hợp lệ' });
        return;
    }


    //Update firebase password
    await auth.updateUser(user.firebaseUId, {
        password: String(newPassword)
    })

    //Clear reset fields
    await User.findByIdAndUpdate(user._id, {
        $unset: {
            passwordResetCodeHash: 1,
            passwordResetExpires: 1,
            passwordResetVerifiedAt: 1,
            passwordResetTokenHash: 1,
            passwordResetTokenExpires: 1
        },
        $set: { passwordResetAttempts: 0 }
    });
    //Noti reset pass 
    notificationService.notifyPasswordReset(user._id.toString());

    res.status(200).json({
        success: true,
        message: 'Đặt lại mật khẩu thành công'
    });

    return;
}

// Change password (authenticated user)
export const changePassword = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const user = req.user;

        if (!user) {
            res.status(401).json({
                success: false,
                message: 'Người dùng chưa xác thực'
            });
            return;
        }

        // Only email-registered users can change password
        if (user.authProvider !== 'email') {
            res.status(400).json({
                success: false,
                message: 'Đổi mật khẩu chỉ khả dụng cho tài khoản đăng ký bằng email'
            });
            return;
        }

        // Cooldown: require passwordChangedAt field
        const fullUser = await User.findById(user._id).select('+passwordChangedAt');
        if (fullUser?.passwordChangedAt) {
            const hoursSinceLastChange =
                (Date.now() - fullUser.passwordChangedAt.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastChange < 24) {
                const hoursRemaining = Math.ceil(24 - hoursSinceLastChange);
                res.status(429).json({
                    success: false,
                    message: `Bạn chỉ có thể đổi mật khẩu 1 lần mỗi 24 giờ. Vui lòng thử lại sau ${hoursRemaining} giờ.`
                });
                return;
            }
        }

        const { currentPassword, newPassword } = req.body;

        // Verify current password via Firebase REST API
        const verifyResponse = await fetch(
            `${FIREBASE_AUTH_URL}:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    password: currentPassword,
                    returnSecureToken: false
                })
            }
        );

        if (!verifyResponse.ok) {
            res.status(401).json({
                success: false,
                message: 'Mật khẩu hiện tại không chính xác'
            });
            return;
        }

        // Update password in Firebase
        await auth.updateUser(user.firebaseUId, {
            password: String(newPassword)
        });

        // Revoke all existing refresh tokens
        await auth.revokeRefreshTokens(user.firebaseUId);

        // Save passwordChangedAt
        await User.findByIdAndUpdate(user._id, {
            passwordChangedAt: new Date()
        });

        // Generate new custom token so client can re-authenticate
        const customToken = await auth.createCustomToken(user.firebaseUId);

        // Đổi luôn sang idToken + refreshToken
        const tokenExchangeResponse = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: customToken, returnSecureToken: true }),
            }
        );

        const tokenData: any = await tokenExchangeResponse.json();

        if (!tokenExchangeResponse.ok) {
            res.status(500).json({
                success: false,
                message: 'Không thể tạo phiên đăng nhập sau khi đổi mật khẩu'
            });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Đổi mật khẩu thành công',
            data: {
                idToken: tokenData.idToken,
                refreshToken: tokenData.refreshToken,
                expiresIn: tokenData.expiresIn,
            }
        });

        //Noti change pass
        notificationService.notifyPasswordChanged(user._id.toString());

        // Send notification email
        sendPasswordChangedEmail(user.email, user.fullName || '').catch(err =>
            console.error('Failed to send password changed email:', err)
        );

        return;
    } catch (error: any) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Đổi mật khẩu thất bại'
        });
    }
};


// POST /api/users/kyc - Verify KYC via CCCD
export const verifyKYC = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Người dùng chưa xác thực'
            });
            return;
        }

        const { imageUrl } = req.body;

        if (!imageUrl || typeof imageUrl !== 'string') {
            res.status(400).json({
                success: false,
                message: 'imageUrl (URL ảnh CCCD) là bắt buộc'
            });
            return;
        }

        // Check if already verified
        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
            return;
        }

        if (user.kycStatus === 'VERIFIED') {
            const maskedIdNumber = user.kycIdNumberMasked
                || (user.kycIdNumber ? maskSensitive(user.kycIdNumber) : null);
            res.status(400).json({
                success: false,
                message: 'Tài khoản đã được xác thực KYC trước đó',
                data: {
                    kycStatus: user.kycStatus,
                    kycFullName: user.kycFullName,
                    kycIdNumber: maskedIdNumber,
                    kycVerifiedAt: user.kycVerifiedAt
                }
            });
            return;
        }

        // Call FPT.AI
        const { recognizeIdCard } = await import('../services/fptaiService');
        const idData = await recognizeIdCard(imageUrl);

        const maskedIdNumber = maskSensitive(idData.id);
        const encryptedIdNumber = encryptSensitive(idData.id);

        // Save KYC data to user
        await User.findByIdAndUpdate(userId, {
            kycStatus: 'VERIFIED',
            kycFullName: idData.name,
            kycIdNumber: encryptedIdNumber,
            kycIdNumberMasked: maskedIdNumber,
            kycDob: idData.dob,
            kycAddress: idData.address,
            kycVerifiedAt: new Date(),
            kycData: idData
        });

        res.status(200).json({
            success: true,
            message: 'Xác thực CCCD thành công',
            data: {
                kycStatus: 'VERIFIED',
                kycFullName: idData.name,
                kycIdNumber: maskedIdNumber,
                kycDob: idData.dob,
                kycAddress: idData.address,
                kycVerifiedAt: new Date()
            }
        });

        // Notify
        notificationService.notifyProfileUpdated(userId.toString());
    } catch (error: any) {
        console.error('KYC verification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Xác thực CCCD thất bại. Vui lòng thử lại.'
        });
    }
};


// GET /api/users/kyc - Get KYC status
export const getKYCStatus = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Người dùng chưa xác thực'
            });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy người dùng'
            });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                kycStatus: user.kycStatus || 'NONE',
                kycFullName: user.kycFullName || null,
                kycIdNumber: user.kycIdNumberMasked
                    || (user.kycIdNumber ? maskSensitive(user.kycIdNumber) : null),
                kycDob: user.kycDob || null,
                kycAddress: user.kycAddress || null,
                kycVerifiedAt: user.kycVerifiedAt || null
            }
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Lấy trạng thái KYC thất bại'
        });
    }
};
