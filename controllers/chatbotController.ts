import { Response } from 'express';
import { AuthRequest } from '../types';
import { chatWithBot, ChatMessage } from '../services/chatbotService';
import User from '../models/User';
import Conversation from '../models/Conversation';

const ADMIN_EMAIL = 'xedaptot.contact@gmail.com';

// POST /api/chatbot/message
export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { message, history } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            res.status(400).json({ success: false, message: 'message is required' });
            return;
        }

        const chatHistory: ChatMessage[] = Array.isArray(history)
            ? history
                .filter((h: any) => h.role && h.content)
                .map((h: any) => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    content: String(h.content),
                }))
            : [];

        const result = await chatWithBot(message.trim(), chatHistory, req.user?._id?.toString());

        res.json({
            success: true,
            data: {
                reply: result.reply,
                products: result.products || [],
                orders: result.orders || [],
            },
        });
    } catch (error: any) {
        console.error('[Chatbot] Error:', error.message);
        res.status(500).json({
            success: false,
            message: error.message || 'Lỗi hệ thống AI',
        });
    }
};

// POST /api/chatbot/connect-admin
export const connectAdmin = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Chưa xác thực' });
            return;
        }

        // Find the fixed admin account
        const admin = await User.findOne({ email: ADMIN_EMAIL });
        if (!admin) {
            res.status(404).json({
                success: false,
                message: 'Không tìm thấy admin. Vui lòng thử lại sau.',
            });
            return;
        }

        // Prevent admin from chatting with themselves
        if (userId.toString() === admin._id.toString()) {
            res.status(400).json({
                success: false,
                message: 'Admin không thể tự chat với chính mình qua kênh hỗ trợ.',
            });
            return;
        }

        // Find existing conversation or create new one
        let conversation = await Conversation.findOne({
            participants: { $all: [userId, admin._id] },
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [userId, admin._id],
            });
        }

        res.json({
            success: true,
            data: {
                conversationId: conversation._id,
                admin: {
                    _id: admin._id,
                    fullName: admin.fullName || 'Admin Bike Connect',
                    avatarUrl: admin.avatarUrl || null,
                },
            },
        });
    } catch (error: any) {
        console.error('[Chatbot] Connect admin error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Không thể kết nối với admin',
        });
    }
};
