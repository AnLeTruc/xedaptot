import { Response } from 'express';
import { AuthRequest } from '../types';
import Notification from '../models/Notification';
import { GetNotificationsQuery } from '../validations/notificationValidation';

//Get noti
export const getNotifications = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { page, limit, type, isRead } = req.query as unknown as GetNotificationsQuery;

        const filter: Record<string, any> = { userId };
        if (type) filter.type = type;
        if (isRead !== undefined) filter.isRead = isRead;

        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments(filter),
            Notification.countDocuments({ userId, isRead: false })
        ]);

        res.status(200).json({
            success: true,
            data: {
                notifications: notifications.map(n => ({
                    id: n._id,
                    type: n.type,
                    title: n.title,
                    message: n.message,
                    url: n.url ?? null,
                    is_read: n.isRead,
                    created_at: n.createdAt
                })),
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                },
                unreadCount
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

//Read noti
export const markAsRead = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { id } = req.params;

        const notification = await Notification.findOneAndUpdate(
            { _id: id, userId },
            { isRead: true },
            { new: true }
        );

        if (!notification) {
            res.status(404).json({ success: false, message: 'Notification not found' });
            return;
        }

        res.status(200).json({
            success: true,
            message: 'Notification marked as read',
            data: {
                id: notification._id,
                is_read: notification.isRead
            }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};

//Read all noti
export const markAllAsRead = async (
    req: AuthRequest,
    res: Response
): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const result = await Notification.updateMany(
            { userId, isRead: false },
            { isRead: true }
        );

        res.status(200).json({
            success: true,
            message: 'All notifications marked as read',
            data: { updatedCount: result.modifiedCount }
        });
    } catch (error: any) {
        res.status(500).json({ success: false, message: error.message });
    }
};