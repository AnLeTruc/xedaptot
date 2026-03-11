import { Request, Response } from "express";
import mongoose from "mongoose";
import Conversation from "../../models/Conversation";
import Message from "../../models/Message";
import { isValidateObjectId } from "../../validations/customValidation";

const parsePositiveInt = (value: any, defaultValue: number, maxValue: number): number | null => {
    if (value === undefined) return defaultValue;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return Math.min(parsed, maxValue);
};

const parseCursorDate = (value: any): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

// Get all conversations
export const getAllConversationsAdmin = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const limit = parsePositiveInt(req.query.limit, 20, 100);
        const page = parsePositiveInt(req.query.page, 1, 1000);
        if (limit === null || page === null) {
            res.status(400).json({
                message: 'Limit and page must be positive integers'
            });
            return;
        }
        const skip = (page - 1) * limit;

        // Filter variables
        const searchUserId = req.query.userId as string;
        const sortBy = req.query.sortBy as string || 'updatedAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const matchStage: any = {};

        if (searchUserId) {
            if (!isValidateObjectId(searchUserId)) {
                res.status(400).json({
                    message: 'Invalid userId format'
                });
                return;
            }
            matchStage.participants = new mongoose.Types.ObjectId(searchUserId);
        }

        const sortStage: any = {};
        sortStage[sortBy] = sortOrder;

        const pipeline: any[] = [
            { $match: matchStage },
            { $sort: sortStage },
            {
                $facet: {
                    metadata: [{ $count: "total" }, { $addFields: { page: page, limit: limit } }],
                    data: [
                        { $skip: skip },
                        { $limit: limit },
                        {
                            $lookup: {
                                from: 'messages',
                                localField: 'lastMessage',
                                foreignField: '_id',
                                as: 'lastMessageInfo'
                            }
                        },
                        {
                            $unwind: {
                                path: '$lastMessageInfo',
                                preserveNullAndEmptyArrays: true
                            }
                        },
                        {
                            $lookup: {
                                from: 'users',
                                localField: 'participants',
                                foreignField: '_id',
                                pipeline: [
                                    { $project: { fullName: 1, email: 1, avatarUrl: 1, roles: 1 } }
                                ],
                                as: 'participantsInfo'
                            }
                        },
                        {
                            $project: {
                                _id: 1,
                                participants: '$participantsInfo',
                                createdAt: 1,
                                updatedAt: 1,
                                lastMessage: {
                                    _id: '$lastMessageInfo._id',
                                    content: '$lastMessageInfo.content',
                                    type: '$lastMessageInfo.type',
                                    createdAt: '$lastMessageInfo.createdAt',
                                    senderId: '$lastMessageInfo.senderId',
                                    isRead: '$lastMessageInfo.isRead'
                                }
                            }
                        }
                    ]
                }
            }
        ];

        const result = await Conversation.aggregate(pipeline);

        const data = result[0]?.data || [];
        const total = result[0]?.metadata[0]?.total || 0;
        const totalPages = Math.ceil(total / limit);

        res.status(200).json({
            message: 'Lấy danh sách đoạn hội thoại thành công',
            data: data,
            pagination: {
                total,
                page,
                limit,
                totalPages
            }
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
};

// Get conversation history
export const getConversationMessagesAdmin = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const limit = parsePositiveInt(req.query.limit, 20, 100);
        if (limit === null) {
            res.status(400).json({
                message: 'Limit must be a positive integer'
            });
            return;
        }

        const cursor = parseCursorDate(req.query.cursor);
        if (req.query.cursor && !cursor) {
            res.status(400).json({
                message: 'Invalid cursor format'
            });
            return;
        }

        if (!conversationId) {
            res.status(400).json({
                message: 'Conversation ID is required'
            });
            return;
        }

        if (!isValidateObjectId(conversationId)) {
            res.status(400).json({
                message: 'Invalid conversationId format'
            });
            return;
        }

        const currentConversation = await Conversation.findById(conversationId);
        if (!currentConversation) {
            res.status(404).json({
                message: 'Không tìm thấy cuộc hội thoại này'
            });
            return;
        }

        const messageQuery: any = {
            conversationId: conversationId
        };

        if (cursor) {
            messageQuery.createdAt = {
                $lt: cursor
            };
        }

        const messages = await Message.find(messageQuery)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate({
                path: 'bicycleId',
                select: 'name thumbnail price origin status'
            })
            .populate({
                path: 'senderId',
                select: 'fullName avatarUrl email roles'
            });

        let nextCursor = null;
        if (messages.length === limit) {
            nextCursor = messages[messages.length - 1].createdAt;
        }

        const reversedMessages = messages.reverse();

        res.status(200).json({
            message: 'Lấy lịch sử tin nhắn thành công',
            data: reversedMessages,
            pagination: {
                nextCursor: nextCursor,
                limit: limit
            }
        });
    } catch (error: any) {
        res.status(500).json({
            message: error.message
        });
    }
};

//Lock conversation
export const lockConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;
        const { status, duration, reason } = req.body;

        if (!isValidateObjectId(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid conversation id'
            });
            return;
        }

        if (!['TEMP_LOCKED', 'PERM_LOCKED'].includes(status)) {
            res.status(400).json({
                success: false,
                message: 'status must be TEMP_LOCKED or PERM_LOCKED'
            });
            return;
        }

        let lockedUntil: Date | null = null;
        if (status === 'TEMP_LOCKED') {
            const durationMinutes = Number(duration);
            if (!durationMinutes || durationMinutes <= 0) {
                res.status(400).json({
                    success: false,
                    message: 'duration (minutes) is required for TEMP_LOCKED'
                });
                return;
            }
            lockedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);
        }

        const conversation = await Conversation.findByIdAndUpdate(
            id,
            {
                $set: {
                    lockedStatus: status,
                    lockedUntil,
                    lockedReason: reason || 'Admin locked conversation'
                }
            },
            { new: true }
        );

        if (!conversation) {
            res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
            return;
        }

        try {
            const { getIO } = require('../../services/socketService');
            const io = getIO();
            conversation.participants.forEach((participantId) => {
                io.to(participantId.toString()).emit('conversation_locked', {
                    conversationId: conversation._id.toString(),
                    lockedStatus: conversation.lockedStatus,
                    lockedUntil: conversation.lockedUntil,
                    lockedReason: conversation.lockedReason
                });
            });
        } catch (socketError) {
            console.error('Socket not initialized', socketError);
        }

        res.status(200).json({
            success: true,
            message: 'Conversation locked successfully',
            data: conversation
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

//Unlock conversation
export const unlockConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { id } = req.params;

        if (!isValidateObjectId(id)) {
            res.status(400).json({
                success: false,
                message: 'Invalid conversation id'
            });
            return;
        }

        const conversation = await Conversation.findByIdAndUpdate(
            id,
            {
                $set: {
                    lockedStatus: 'NONE',
                    lockedUntil: null,
                    lockedReason: null,
                    violationCount: 0
                }
            },
            { new: true }
        );

        if (!conversation) {
            res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
            return;
        }

        try {
            const { getIO } = require('../../services/socketService');
            const io = getIO();
            conversation.participants.forEach((participantId) => {
                io.to(participantId.toString()).emit('conversation_unlocked', {
                    conversationId: conversation._id.toString()
                });
            });
        } catch (socketError) {
            console.error('Socket not initialized', socketError);
        }

        res.status(200).json({
            success: true,
            message: 'Conversation unlocked successfully',
            data: conversation
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
