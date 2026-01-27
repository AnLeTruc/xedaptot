import cron from 'node-cron';
import cloudinary from '../config/cloudinary';
import TempMedia from '../models/TempMedia';

const schedule = '0 3 * * *';

export const startCleanupJob = () => {
    console.log(`[Cronjob] Initialized cleanup job with schedule: ${schedule}`);

    cron.schedule(schedule, async () => {
        console.log('[Cronjob] Starting cleanup check...');

        try {
            const limitTime = new Date(Date.now() - 24 * 60 * 60 * 1000);

            const oldFiles = await TempMedia.find({
                createdAt: { $lt: limitTime }
            }).limit(100);

            if (oldFiles.length === 0) {
                console.log('[Cronjob] No old files found to clean.');
                return;
            }

            console.log(`[Cronjob] Found ${oldFiles.length} files to clean.`);

            const publicIds = oldFiles.map(file => file.public_id);
            const dbIds = oldFiles.map(file => file._id);

            if (publicIds.length > 0) {
                try {
                    const result = await cloudinary.api.delete_resources(publicIds);
                    console.log('[Cronjob] Cloudinary deletion result:', result);
                } catch (cloudError) {
                    console.error('[Cronjob] Cloudinary bulk delete error:', cloudError);
                }
            }
            await TempMedia.deleteMany({ _id: { $in: dbIds } });

            console.log(`[Cronjob] Cleaned up ${dbIds.length} records from DB.`);

        } catch (error) {
            console.error('[Cronjob] Error during cleanup:', error);
        }
    });
};
