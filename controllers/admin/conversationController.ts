import { Request, Response } from "express";
import mongoose from "mongoose";
import Conversation from "../../models/Conversation";

// Get all conversations
export const getAllConversationsAdmin = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const limit = parseInt(req.query.limit as string) || 20;
        const page = parseInt(req.query.page as string) || 1;
        const skip = (page - 1) * limit;

        // Filter variables
        const searchUserId = req.query.userId as string;
        const sortBy = req.query.sortBy as string || 'updatedAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        const matchStage: any = {};

        if (searchUserId) {
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
        const limit = parseInt(req.query.limit as string) || 20;
        const cursor = req.query.cursor ? new Date(req.query.cursor as string) : null;

        if (!conversationId) {
            res.status(400).json({
                message: 'Conversation ID is required'
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

        const messages = await mongoose.model('Message').find(messageQuery)
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
