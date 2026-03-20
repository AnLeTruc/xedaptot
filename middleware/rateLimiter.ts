import rateLimit from 'express-rate-limit';

//General limter for all routes
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: {
        success: false,
        message: 'Quá nhiều yêu cầu, vui lòng thử lại sau'
    },
    standardHeaders: true,
    legacyHeaders: false
});

//Auth 
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Change password - stricter limit
export const changePasswordLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        success: false,
        message: 'Quá nhiều lần đổi mật khẩu, vui lòng thử lại sau 15 phút'
    },
    standardHeaders: true,
    legacyHeaders: false
});

