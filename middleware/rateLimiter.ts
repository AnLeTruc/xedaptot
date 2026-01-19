import rateLimit from 'express-rate-limit';

//General limter for all routes
export const generalLimter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many request, please try again later'
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
        message: 'Too many login attempts, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
});

