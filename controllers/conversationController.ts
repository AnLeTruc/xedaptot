import { Request, Response } from "express";
import mongoose from "mongoose";
import Conversation from "../models/Conversation";
import User from "../models/User";
import Message from "../models/Message";

//Find & create conversation
export const createConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { receiverId } = req.body;
        const senderId = (req as any).user?._id;

        if (senderId.toString() === receiverId.toString()) {
            res.status(400).json({
                message: 'You cannot create a conversation with yourself'
            })
            return;
        };

        const receiverExists = await User.findById(receiverId);
        if (!receiverExists) {
            res.status(404).json({ message: "Receiver User not found" });
            return;
        }

        //Find if not found upsert
        const conversation = await Conversation.findOneAndUpdate(
            { participants: { $all: [senderId, receiverId] } },
            {
                $setOnInsert: { participants: [senderId, receiverId] }
            },
            {
                new: true,
                upsert: true
            }
        );

        res.status(200).json({
            message: 'Conversation retrieved or created successfully',
            conversation
        });
    } catch (error: any) {
        res.status(500).json({
            error: error.message
        })
    }
}

//User list conversation
export const getConversations = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userIdRaw = (req as any).user?._id;

        if (!userIdRaw) {
            res.status(401).json({
                message: 'Unauthorized'
            });
            return;
        }

        const userId = new mongoose.Types.ObjectId(userIdRaw.toString());
        const limit = parseInt(req.query.limit as string) || 15;
        const cursor = req.query.cursor ? new Date(req.query.cursor as string) : null;

        const matchStage: any = {
            participants: userId
        };

        if (cursor) {
            matchStage.updatedAt = { $lt: cursor };
        }

        const conversations = await Conversation.aggregate([
            { $match: matchStage },
            { $sort: { updatedAt: -1 } },
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
                $addFields: {
                    chatPartnerId: {
                        $first: {
                            $filter: {
                                input: '$participants',
                                as: 'participantId',
                                cond: { $ne: ['$$participantId', userId] }
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'chatPartnerId',
                    foreignField: '_id',
                    as: 'chatPartnerObj'
                }
            },
            {
                $unwind: {
                    path: '$chatPartnerObj',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: 'messages',
                    let: { convId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$conversationId', '$$convId'] },
                                        { $ne: ['$senderId', userId] },
                                        { $eq: ['$isRead', false] }
                                    ]
                                }
                            }
                        },
                        { $count: 'unreadCount' }
                    ],
                    as: 'unreadMessages'
                }
            },
            {
                $project: {
                    _id: 1,
                    readStatus: 1,
                    updatedAt: 1,
                    createdAt: 1,
                    lastMessage: {
                        _id: '$lastMessageInfo._id',
                        content: '$lastMessageInfo.content',
                        type: '$lastMessageInfo.type',
                        createdAt: '$lastMessageInfo.createdAt',
                        isRead: '$lastMessageInfo.isRead',
                        senderId: '$lastMessageInfo.senderId',
                        bicycleId: '$lastMessageInfo.bicycleId'
                    },
                    chatPartner: {
                        _id: '$chatPartnerObj._id',
                        fullName: '$chatPartnerObj.fullName',
                        avatarUrl: '$chatPartnerObj.avatarUrl',
                        email: '$chatPartnerObj.email',
                        roles: '$chatPartnerObj.roles'
                    },
                    unreadCount: {
                        $ifNull: [{ $arrayElemAt: ['$unreadMessages.unreadCount', 0] }, 0]
                    }
                }
            }
        ]);

        const nextCursor = conversations.length === limit ? conversations[conversations.length - 1].updatedAt : null;

        res.status(200).json({
            message: 'Conversations retrieved successfully',
            data: conversations,
            pagination: {
                nextCursor,
                limit
            }
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
};

//Message History
export const getMessageHistory = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const currentUser = (req as any).user._id;

        const limit = parseInt(req.query.limit as string) || 20;
        const cursor = req.query.cursor ? new Date(req.query.cursor as string) : null;

        if (!conversationId) {
            res.status(404).json({
                message: 'ConversationID is required'
            });
            return;
        }

        const currentConversation = await Conversation.findById(conversationId);
        if (!currentConversation) {
            res.status(201).json({
                message: 'Không tìm thấy cuộc hội thoại này'
            });
            return;
        }

        //Check participants
        const isParticipant = currentConversation.participants.some(
            (pariticipantId) => pariticipantId.toString() === currentUser.toString()
        );
        if (!isParticipant) {
            res.status(403).json({
                message: 'Bạn không có  quyền xem cuộc hội thoại này'
            })
            return;
        };

        //Query
        const messageQuery: any = {
            conversationId: conversationId
        };

        if (cursor) {
            messageQuery.createdAt = {
                $lt: cursor
            };
        }

        const message = await Message.find(messageQuery)
            .sort({
                createdAt: -1
            })
            .limit(limit)
            //Populate embed bicycle
            .populate({
                path: 'bicycleId',
                select: 'name thumbnail price origin status'
            });

        //Next cursor
        let nextCursor = null;
        if (message.length === limit) {
            nextCursor = message[message.length - 1].createdAt;
        }

        res.status(200).json({
            message: 'Lấy lịch sử tin nhắn thành công',
            data: message,
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
}

//Mark as read 
export const markAsRead = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const currentUser = (req as any).user._id;

        if (!conversationId) {
            res.status(400).json({
                message: 'Conversation ID is required'
            });
            return;
        }

        const conversation = await Conversation.findOneAndUpdate(
            {
                _id: conversationId,
                participants: currentUser
            },
            {
                $set: { [`readStatus.${currentUser.toString()}`]: new Date() }
            },
            { new: true }
        );

        if (!conversation) {
            res.status(404).json({ message: 'Không tìm thấy hội thoại hoặc không có quyền truy cập' });
            return;
        }

        await Message.updateMany(
            {
                conversationId: conversationId,
                senderId: { $ne: currentUser },
                isRead: false
            },
            {
                $set: { isRead: true }
            }
        );

        try {
            const { getIO } = require('../services/socketService');
            const io = getIO();

            // Find partner
            const chatPartnerId = conversation.participants.find(
                p => p.toString() !== currentUser.toString()
            );

            if (chatPartnerId) {
                io.to(chatPartnerId.toString()).emit('messagesRead', {
                    conversationId: conversationId,
                    readBy: currentUser.toString(),
                    readAt: new Date()
                });

                io.to(currentUser.toString()).emit('conversationRead', {
                    conversationId: conversationId
                });
            }
        } catch (socketError) {
            console.error('Socket implementation ready but IO not initialized yet or not found', socketError);
        }

        res.status(200).json({
            message: 'Đánh dấu đã đọc thành công'
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
}