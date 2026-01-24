import crypto from 'crypto';

//Create token for email verification
export const generateVerificationToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

//Token expiry
export const generateTokenExpiry = (): Date => {
    return new Date(Date.now() + 24 * 60 * 60 * 1000);
};