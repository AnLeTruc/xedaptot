import express, { Request, Response } from 'express';
import { upload } from '../middleware/upload';

const router = express.Router();

/**
 * @swagger
 * /upload:
 *   post:
 *     summary: Upload an image
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 *       400:
 *         description: Upload failed
 */
router.post('/', upload.single('image'), (req: Request, res: Response): void => {
    if (!req.file) {
        res.status(400).json({ message: 'No file uploaded' });
        return;
    }

    // req.file.path chứa URL ảnh trên Cloudinary
    res.status(200).json({
        message: 'Upload successful',
        url: req.file.path
    });
});

export default router;
