import express, { Request, Response } from 'express';
import { upload } from '../middleware/upload';
import TempMedia from '../models/TempMedia';

const router = express.Router();

//Upload media
router.post('/', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'Không có tệp nào được tải lên' });
            return;
        }
        await TempMedia.create({
            public_id: req.file.filename,
            url: req.file.path
        });

        res.status(200).json({
            message: 'Tải lên thành công',
            url: req.file.path
        });
    } catch (error: any) {
        res.status(500).json({
            message: 'Lỗi máy chủ khi tải lên',
            error: error.message
        });
    }
});

export default router;
