import { Router, Request, Response, NextFunction } from 'express';
import { uploadGeneral, uploadAvatar, uploadProduct, deleteImage, getPublicIdFromUrl } from '../middleware/upload';

const router = Router();

// Middleware xử lý lỗi Multer
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum 5MB allowed.'
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message || 'Upload failed'
        });
    }
    next();
};

// Upload single image (general purpose)
router.post('/single', (req: Request, res: Response, next: NextFunction) => {
    uploadGeneral(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }

        const file = req.file as Express.Multer.File & { path?: string };

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Image uploaded successfully',
            data: {
                url: file.path,
                filename: file.filename,
                size: file.size,
                mimetype: file.mimetype
            }
        });
    });
});

// Upload avatar
router.post('/avatar', (req: Request, res: Response, next: NextFunction) => {
    uploadAvatar(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }

        const file = req.file as Express.Multer.File & { path?: string };

        if (!file) {
            return res.status(400).json({
                success: false,
                message: 'No avatar uploaded'
            });
        }

        res.status(201).json({
            success: true,
            message: 'Avatar uploaded successfully',
            data: {
                url: file.path
            }
        });
    });
});

// Upload multiple product images
router.post('/products', (req: Request, res: Response, next: NextFunction) => {
    uploadProduct(req, res, (err) => {
        if (err) {
            return handleMulterError(err, req, res, next);
        }

        const files = req.files as (Express.Multer.File & { path?: string })[];

        if (!files || files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files uploaded'
            });
        }

        const uploadedImages = files.map(file => ({
            url: file.path,
            filename: file.filename
        }));

        res.status(201).json({
            success: true,
            message: `${files.length} image(s) uploaded successfully`,
            data: {
                count: files.length,
                images: uploadedImages
            }
        });
    });
});

// Delete image by URL
router.delete('/', async (req: Request, res: Response) => {
    try {
        const { imageUrl } = req.body;

        if (!imageUrl) {
            return res.status(400).json({
                success: false,
                message: 'Image URL is required'
            });
        }

        const publicId = getPublicIdFromUrl(imageUrl);

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'Invalid image URL format'
            });
        }

        const deleted = await deleteImage(publicId);

        if (deleted) {
            res.status(200).json({
                success: true,
                message: 'Image deleted successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to delete image'
            });
        }
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message || 'Delete failed'
        });
    }
});

export default router;
