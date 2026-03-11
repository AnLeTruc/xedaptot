import { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { getIO } from '../services/socketService';
import { MessageType } from '../types';
import { maskRestrictedContent } from '../services/restrictedWordCache';
import { isValidateObjectId } from '../validations/customValidation';

const escapeRegex = (value: string): string => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

//Send message
export const sendMessage = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { conversationId } = req.params;
        const senderId = (req as any).user?._id;
        const { content, type, bicycleId } = req.body;

        if (type === MessageType.SYSTEM) {
            res.status(400).json({
                message: 'MessageType SYSTEM is reserved for server usage'
            });
            return;
        }

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

        const now = new Date();
        if (conversation.lockedStatus === 'PERM_LOCKED') {
            res.status(403).json({
                message: 'Hội thoại đã bị khóa vĩnh viễn',
                lockedStatus: conversation.lockedStatus
            });
            return;
        }

        if (conversation.lockedStatus === 'TEMP_LOCKED') {
            if (conversation.lockedUntil && conversation.lockedUntil > now) {
                res.status(403).json({
                    message: `Hội thoại đã bị khóa đến ${conversation.lockedUntil.toISOString()}`,
                    lockedStatus: conversation.lockedStatus,
                    lockedUntil: conversation.lockedUntil
                });
                return;
            }

            await Conversation.findByIdAndUpdate(conversationId, {
                $set: {
                    lockedStatus: 'NONE',
                    lockedUntil: null,
                    lockedReason: null
                }
            });
        }

        const isTextMessage = type === MessageType.TEXT && typeof content === 'string';
        let maskedContent = content;
        let violatedWords: string[] = [];

        if (isTextMessage && typeof content === 'string') {
            const maskedResult = maskRestrictedContent(content);
            maskedContent = maskedResult.maskedContent;
            violatedWords = maskedResult.violatedWords;
        }

        const matchedWord = violatedWords.length > 0 ? violatedWords[0] : null;

        //Create new message
        const newMessage = new Message({
            conversationId,
            senderId,
            content: maskedContent,
            type,
            ...(bicycleId && { bicycleId })
        });

        let systemMessage: any = null;
        if (matchedWord) {
            systemMessage = new Message({
                conversationId,
                senderId,
                content: `Vi phạm từ cấm: "${matchedWord}"`,
                type: MessageType.SYSTEM
            });
        }

        const messagesToSave = systemMessage ? [newMessage, systemMessage] : [newMessage];
        await Promise.all(messagesToSave.map(msg => msg.save()));

        const updateFields: any = {
            lastMessage: (systemMessage ?? newMessage)._id
        };

        if (matchedWord) {
            updateFields.lockedReason = `Vi phạm từ cấm: "${matchedWord}"`;
        }

        const updatedConversation = await Conversation.findByIdAndUpdate(
            conversationId,
            {
                $set: updateFields,
                $pull: { hiddenBy: { $in: conversation.participants } },
                $currentDate: { updatedAt: true },
                ...(matchedWord ? { $inc: { violationCount: 1 } } : {})
            },
            { new: true }
        );

        if (matchedWord && updatedConversation) {
            if (updatedConversation.violationCount >= 3 && updatedConversation.lockedStatus !== 'PERM_LOCKED') {
                const lockUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
                await Conversation.findByIdAndUpdate(conversationId, {
                    $set: {
                        lockedStatus: 'TEMP_LOCKED',
                        lockedUntil: lockUntil,
                        lockedReason: 'Vi phạm nội quy chat từ cấm từ 3 lần trở lên'
                    }
                });
                updatedConversation.lockedStatus = 'TEMP_LOCKED' as any;
                updatedConversation.lockedUntil = lockUntil;
                updatedConversation.lockedReason = 'Vi phạm nội quy chat từ cấm từ 3 lần trở lên';
            }
        }

        //Socket emit
        const receiverId = conversation.participants.find((id) => id.toString() !== senderId.toString());
        if (receiverId) {
            const io = getIO();
            //Emit event to private room
            io.to(receiverId.toString()).emit("new_message", newMessage);

            if (systemMessage) {
                io.to(receiverId.toString()).emit("new_message", systemMessage);
                io.to(senderId.toString()).emit("new_message", systemMessage);
            }

            if (updatedConversation?.lockedStatus === 'TEMP_LOCKED') {
                const lockPayload = {
                    conversationId: conversationId,
                    lockedStatus: updatedConversation.lockedStatus,
                    lockedUntil: updatedConversation.lockedUntil,
                    lockedReason: updatedConversation.lockedReason
                };
                io.to(receiverId.toString()).emit('conversation_locked', lockPayload);
                io.to(senderId.toString()).emit('conversation_locked', lockPayload);
            }
        }

        res.status(201).json({
            message: "Message sent successfully",
            data: newMessage,
            violationCount: updatedConversation?.violationCount
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
            if (typeof conversationId !== 'string' || !isValidateObjectId(conversationId)) {
                res.status(400).json({ message: 'Invalid conversationId format' });
                return;
            }
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

        const safeKeyword = escapeRegex(keyword);

        const messages = await Message.find({
            conversationId: { $in: conversationIdsToSearch },
            content: { $regex: safeKeyword, $options: 'i' }
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