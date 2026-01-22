import multer, { FileFilterCallback } from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { Request } from 'express';
import cloudinary from '../config/cloudinary';

type UploadFolder = 'avatars' | 'products' | 'brands' | 'categories' | 'general';

//Cloudinary Storage
const createStorage = (folder: UploadFolder) => {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req: Request, file: Express.Multer.File) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const filename = `${folder}_${uniqueSuffix}`;

            return {
                folder: `xedaptot/${folder}`,
                public_id: filename,
                allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
                transformation: [
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' }
                ]
            };
        }
    });
};

const imageFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpg, png, gif, webp)'));
    }
};

// File size (5MB)
const limits = {
    fileSize: 5 * 1024 * 1024
};

//Upload middleware
export const uploadAvatar = multer({
    storage: createStorage('avatars'),
    fileFilter: imageFilter,
    limits
}).single('avatar');

export const uploadProduct = multer({
    storage: createStorage('products'),
    fileFilter: imageFilter,
    limits
}).array('images', 10);

export const uploadBrand = multer({
    storage: createStorage('brands'),
    fileFilter: imageFilter,
    limits
}).single('image');

export const uploadCategory = multer({
    storage: createStorage('categories'),
    fileFilter: imageFilter,
    limits
}).single('image');

export const uploadGeneral = multer({
    storage: createStorage('general'),
    fileFilter: imageFilter,
    limits
}).single('image');

// Helper function
export const deleteImage = async (publicId: string): Promise<boolean> => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        return result.result === 'ok';
    } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
        return false;
    }
};

// Helper function
export const getPublicIdFromUrl = (url: string): string | null => {
    try {
        const regex = /\/v\d+\/(.+)\.[a-z]+$/i;
        const match = url.match(regex);
        return match ? match[1] : null;
    } catch {
        return null;
    }
};
