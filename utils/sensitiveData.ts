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

export const decryptSensitive = (payload: string): string => {
    const key = getEncryptionKey();
    const [ivB64, tagB64, dataB64] = `${payload ?? ''}`.split(':');

    if (!ivB64 || !tagB64 || !dataB64) {
        throw new Error('Invalid encrypted payload format');
    }

    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(dataB64, 'base64');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
};

export const hashSensitive = (value: string): string => {
    const key = getEncryptionKey();
    const normalized = `${value ?? ''}`.trim();
    return crypto.createHmac('sha256', key).update(normalized, 'utf8').digest('hex');
};

export const maskSensitive = (value: string, visibleDigits: number = 3): string => {
    const normalized = `${value ?? ''}`;
    const keep = Math.max(0, visibleDigits);

    if (normalized.length <= keep) {
        return normalized;
    }

    return `${'*'.repeat(normalized.length - keep)}${normalized.slice(-keep)}`;
};
