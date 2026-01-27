import crypto from 'crypto';

export const generate6DigitCode = (): string => String(crypto.randomInt(0,1_000_000)).padStart(6, '0');

export const timingSafeEqualHex = (aHex: string, bHex: string) => {
    const a = Buffer.from(aHex, 'hex');
    const b = Buffer.from(bHex, 'hex');

    if (a.length !== b.length) {
        return false
    };

    return crypto.timingSafeEqual(a, b);
};

export const hashResetCode = (email: string, code: string) => {
    const secret = process.env.RESET_CODE_SECRET;

    if(!secret) throw new Error ('Missing RESET_CODE_SECRET environment variable');
    return crypto
        .createHmac('sha256', secret)
        .update(`${email.toLowerCase()}|${code}`)
        .digest('hex');
};

export const hashResetToken = (resetToken: string) => {
    const secret = process.env.RESET_TOKEN_SECRET;
    if(!secret) throw new Error ('Missing RESET_TOKEN_SECRET environment variable');

    return crypto
        .createHmac('sha256', secret)
        .update(resetToken)
        .digest('hex');
};