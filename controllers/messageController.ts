import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { getIO } from '../services/socketService';

//Send message
export const sendMessage = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { conversationId } = req.params;
        const senderId = (req as any).user?._id;
        const { content, type, bicycleId } = req.body;


        //Find conversation 
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: {
                $in: [senderId]
            }
        });

        if (!conversation) {
            res.status(403).json({
                message: 'Conversation not found or you don\'t have access'
            });
            return;
        }

        //Create new message
        const newMessage = new Message({
            conversationId,
            senderId,
            content,
            type,
            ...(bicycleId && { bicycleId })
        });

        //Save message + update last message
        await Promise.all([
            newMessage.save(),
            Conversation.findByIdAndUpdate(
                conversationId,
                { $set: { lastMessage: newMessage._id } },
                { new: true }
            )
        ]);

        //Socket emit
        const receiverId = conversation.participants.find((id) => id.toString() !== senderId.toString());
        if (receiverId) {
            const io = getIO();
            //Emit event to private room
            io.to(receiverId.toString()).emit("new_message", newMessage);
        }

        res.status(201).json({
            message: "Message sent successfully",
            data: newMessage
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
};

// Search messages (Global & Local)
export const searchMessages = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { keyword, conversationId } = req.query;
        const currentUser = (req as any).user._id;

        if (!keyword || typeof keyword !== 'string') {
            res.status(400).json({ message: 'Từ khóa tìm kiếm (keyword) là bắt buộc' });
            return;
        }

        let conversationIdsToSearch: any[] = [];

        //conversationId (Search Local)
        if (conversationId) {
            const conversation = await Conversation.findOne({
                _id: conversationId,
                participants: currentUser
            });

            if (!conversation) {
                res.status(403).json({ message: 'Không tìm thấy hội thoại hoặc không có quyền truy cập' });
                return;
            }
            conversationIdsToSearch = [conversation._id];
        } else {
            // Search Global
            const conversations = await Conversation.find({ participants: currentUser }).select('_id');
            conversationIdsToSearch = conversations.map(c => c._id);
        }

        if (conversationIdsToSearch.length === 0) {
            res.status(200).json({ message: 'Tìm kiếm thành công', data: [] });
            return;
        }

        const messages = await Message.find({
            conversationId: { $in: conversationIdsToSearch },
            content: { $regex: keyword, $options: 'i' }
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate({
                path: 'conversationId',
                select: 'participants',
                populate: {
                    path: 'participants',
                    select: 'fullName avatarUrl'
                }
            });

        res.status(200).json({
            message: 'Tìm kiếm thành công',
            data: messages
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
};