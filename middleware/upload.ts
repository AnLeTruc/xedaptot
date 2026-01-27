import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary';

interface CloudinaryParams {
    folder: string;
    allowed_formats: string[];
    public_id?: (
        req: any,
        file: any
    ) => string;
    resource_type?: string;
}

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'xedaptot/products',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'mp4', 'mov', 'avi'],
        resource_type: 'auto'
    } as CloudinaryParams,
});

export const upload = multer({ storage: storage });

