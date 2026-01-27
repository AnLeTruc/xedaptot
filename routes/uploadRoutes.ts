import express, { Request, Response } from 'express';
import { upload } from '../middleware/upload';
import TempMedia from '../models/TempMedia';

const router = express.Router();

//Upload media
router.post('/', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }
        await TempMedia.create({
            public_id: req.file.filename,
            url: req.file.path
        });

        res.status(200).json({
            message: 'Upload successful',
            url: req.file.path
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Server error during upload',
            error: error.message
        });
    }
});

export default router;
