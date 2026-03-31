import crypto from 'crypto';

const getEncryptionKey = (): Buffer => {
    const secret = process.env.DATA_ENCRYPTION_KEY;
    if (!secret) {
        throw new Error('DATA_ENCRYPTION_KEY is required');
    }

    return crypto.createHash('sha256').update(secret).digest();
};

export const encryptSensitive = (value: string): string => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

export const maskSensitive = (value: string, visibleDigits: number = 3): string => {
    const normalized = `${value ?? ''}`;
    const keep = Math.max(0, visibleDigits);

    if (normalized.length <= keep) {
        return normalized;
    }

    return `${'*'.repeat(normalized.length - keep)}${normalized.slice(-keep)}`;
};
