import { Request, Response } from "express";
import mongoose from "mongoose";
import Conversation from "../models/Conversation";
import User from "../models/User";
import Message from "../models/Message";
import { isValidateObjectId } from "../validations/customValidation";

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

//Find & create conversation
export const createConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const { receiverId } = req.body;
        const senderId = (req as any).user?._id;

        if (!receiverId || !isValidateObjectId(receiverId)) {
            res.status(400).json({
                message: 'Invalid receiverId format'
            });
            return;
        }

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

        let conversation = await Conversation.findOne({
            participants: { $all: [senderId, receiverId] }
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [senderId, receiverId]
            });
        }

        res.status(200).json({
            message: 'Conversation retrieved or created successfully',
            conversation: {
                ...conversation.toObject(),
                violationCount: conversation.violationCount ?? 0,
                lockedStatus: conversation.lockedStatus ?? 'NONE',
                lockedUntil: conversation.lockedUntil ?? null,
                lockedReason: conversation.lockedReason ?? null
            }
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
        const limit = parsePositiveInt(req.query.limit, 15, 100);
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

        const matchStage: any = {
            participants: userId,
            hiddenBy: { $ne: userId }
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
                message: 'ConversationID is required'
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
                select: 'title images price condition status'
            });

        //Next cursor
        let nextCursor = null;
        if (message.length === limit) {
            nextCursor = message[message.length - 1].createdAt;
        }

        //Rev mess
        const reversedMessages = message.reverse();

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
}

//Mark as read 
export const markAsRead = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const currentUser = (req as any).user._id;

        if (!conversationId || !isValidateObjectId(conversationId)) {
            res.status(400).json({
                message: 'Invalid Conversation ID format'
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

// Mark as unread
export const markAsUnread = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const currentUser = (req as any).user._id;

        if (!conversationId || !isValidateObjectId(conversationId)) {
            res.status(400).json({
                message: 'Invalid Conversation ID format'
            });
            return;
        }

        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: currentUser
        });

        if (!conversation) {
            res.status(404).json({ message: 'Không tìm thấy hội thoại' });
            return;
        }

        //Last mess from partner
        const lastMessageFromPartner = await Message.findOne({
            conversationId: conversationId,
            senderId: { $ne: currentUser }
        }).sort({ createdAt: -1 });

        if (lastMessageFromPartner) {
            lastMessageFromPartner.isRead = false;
            await lastMessageFromPartner.save();

            await Conversation.updateOne(
                { _id: conversationId },
                { $unset: { [`readStatus.${currentUser.toString()}`]: "" } }
            );

            try {
                const { getIO } = require('../services/socketService');
                const io = getIO();
                io.to(currentUser.toString()).emit('conversationUnread', {
                    conversationId: conversationId
                });
            } catch (err) {
                console.error(err);
            }
        }

        res.status(200).json({
            message: 'Đánh dấu chưa đọc thành công'
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
}

// Unread count
export const getUnreadCount = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userId = (req as any).user._id;

        const conversations = await Conversation.find({
            participants: userId,
            hiddenBy: { $ne: userId }
        }).select('_id');

        const conversationIds = conversations.map(c => c._id);

        if (conversationIds.length === 0) {
            res.status(200).json({ unreadCount: 0 });
            return;
        }

        const unreadCount = await Message.countDocuments({
            conversationId: { $in: conversationIds },
            senderId: { $ne: userId },
            isRead: false
        });

        res.status(200).json({
            unreadCount: unreadCount
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
}

// Start support conversation
export const startSupportConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userId = (req as any).user?._id;

        const admins = await User.find({ roles: { $in: ['ADMIN'] } }).select('_id fullName avatarUrl');
        if (admins.length === 0) {
            res.status(503).json({ message: 'Không có người hỗ trợ nào khả dụng' });
            return;
        }

        // Check if user already has a conversation with any admin
        const adminIds = admins.map(a => a._id);
        const existing = await Conversation.findOne({
            $and: [
                { participants: userId },
                { participants: { $in: adminIds } }
            ]
        });

        if (existing) {
            const partnerId = existing.participants.find(p => p.toString() !== userId.toString());
            const partner = admins.find(a => a._id.toString() === partnerId?.toString());
            res.status(200).json({
                conversationId: existing._id,
                partner: {
                    _id: partner?._id,
                    fullName: partner?.fullName ?? 'Hỗ trợ BikeConnect',
                    avatarUrl: partner?.avatarUrl ?? null,
                }
            });
            return;
        }

        const counts = await Promise.all(
            admins.map(async (admin) => ({
                admin,
                count: await Conversation.countDocuments({ participants: admin._id })
            }))
        );
        counts.sort((a, b) => a.count - b.count);
        const selectedAdmin = counts[0].admin;

        const conversation = await Conversation.create({
            participants: [userId, selectedAdmin._id]
        });

        res.status(201).json({
            conversationId: conversation._id,
            partner: {
                _id: selectedAdmin._id,
                fullName: selectedAdmin.fullName ?? 'Hỗ trợ BikeConnect',
                avatarUrl: selectedAdmin.avatarUrl ?? null,
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};

// Hide a conversation (Soft delete)
export const hideConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const currentUser = (req as any).user._id;

        if (!conversationId || !isValidateObjectId(conversationId)) {
            res.status(400).json({
                message: 'Invalid Conversation ID format'
            });
            return;
        }

        const conversation = await Conversation.findOneAndUpdate(
            {
                _id: conversationId,
                participants: currentUser
            },
            {
                $addToSet: { hiddenBy: currentUser }
            },
            { new: true }
        );

        if (!conversation) {
            res.status(404).json({ message: 'Không tìm thấy hội thoại hoặc không có quyền truy cập' });
            return;
        }

        res.status(200).json({
            message: 'Đã ẩn cuộc hội thoại thành công'
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
}

export const unhideConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const currentUser = (req as any).user._id;

        if (!conversationId || !isValidateObjectId(conversationId)) {
            res.status(400).json({
                message: 'Invalid Conversation ID format'
            });
            return;
        }

        const conversation = await Conversation.findOneAndUpdate(
            {
                _id: conversationId,
                participants: currentUser
            },
            {
                $pull: { hiddenBy: currentUser }
            },
            { new: true }
        );

        if (!conversation) {
            res.status(404).json({ message: 'Không tìm thấy hội thoại hoặc không có quyền truy cập' });
            return;
        }

        res.status(200).json({
            message: 'Đã hiện lại cuộc hội thoại thành công'
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
}


//Delete conversation
export const deleteConversation = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const conversationId = req.params.id;
        const currentUser = (req as any).user._id;

        if (!conversationId || !isValidateObjectId(conversationId)) {
            res.status(400).json({
                message: 'Invalid Conversation ID format'
            });
            return;
        }

        // Kiểm tra conversation tồn tại và user là participant
        const conversation = await Conversation.findOne({
            _id: conversationId,
            participants: currentUser
        });

        if (!conversation) {
            res.status(404).json({
                message: 'Không tìm thấy hội thoại hoặc không có quyền truy cập'
            });
            return;
        }

        // Xóa tất cả messages trong conversation
        await Message.deleteMany({ conversationId: conversationId });

        // Xóa conversation
        await Conversation.findByIdAndDelete(conversationId);

        // Emit socket event cho participants
        try {
            const { getIO } = require('../services/socketService');
            const io = getIO();

            conversation.participants.forEach((participantId) => {
                io.to(participantId.toString()).emit('conversationDeleted', {
                    conversationId: conversationId
                });
            });
        } catch (socketError) {
            console.error('Socket error:', socketError);
        }

        res.status(200).json({
            message: 'Xóa hội thoại thành công'
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
};

//Delete all conversation
export const deleteAllConversations = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const currentUser = (req as any).user._id;

        // Lấy tất cả conversations của user
        const conversations = await Conversation.find({
            participants: currentUser
        }).select('_id');

        if (conversations.length === 0) {
            res.status(200).json({
                message: 'Không có hội thoại nào để xóa',
                deletedCount: 0
            });
            return;
        }

        const conversationIds = conversations.map(c => c._id);

        // Xóa tất cả messages
        await Message.deleteMany({
            conversationId: { $in: conversationIds }
        });

        // Xóa tất cả conversations
        const result = await Conversation.deleteMany({
            _id: { $in: conversationIds }
        });

        // Emit socket event
        try {
            const { getIO } = require('../services/socketService');
            const io = getIO();
            io.to(currentUser.toString()).emit('allConversationsDeleted', {
                deletedCount: result.deletedCount
            });
        } catch (socketError) {
            console.error('Socket error:', socketError);
        }

        res.status(200).json({
            message: 'Xóa tất cả hội thoại thành công',
            deletedCount: result.deletedCount
        });

    } catch (error: any) {
        res.status(500).json({
            error: error.message
        });
    }
};

// Get hidden conversations
export const getHiddenConversations = async (
    req: Request,
    res: Response
): Promise<void> => {
    try {
        const userIdRaw = (req as any).user?._id;

        if (!userIdRaw) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const userId = new mongoose.Types.ObjectId(userIdRaw.toString());

        const limit = parsePositiveInt(req.query.limit, 15, 100);
        if (limit === null) {
            res.status(400).json({ message: 'Limit must be a positive integer' });
            return;
        }

        const cursor = parseCursorDate(req.query.cursor);
        if (req.query.cursor && !cursor) {
            res.status(400).json({ message: 'Invalid cursor format' });
            return;
        }

        // Chỉ lấy conversations bị ẩn bởi user này
        const matchStage: any = {
            participants: userId,
            hiddenBy: userId  // ← ngược với getConversations ($ne → phải có)
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
                $project: {
                    _id: 1,
                    updatedAt: 1,
                    createdAt: 1,
                    hiddenAt: 1,
                    lastMessage: {
                        _id: '$lastMessageInfo._id',
                        content: '$lastMessageInfo.content',
                        type: '$lastMessageInfo.type',
                        createdAt: '$lastMessageInfo.createdAt',
                        senderId: '$lastMessageInfo.senderId'
                    },
                    chatPartner: {
                        _id: '$chatPartnerObj._id',
                        fullName: '$chatPartnerObj.fullName',
                        avatarUrl: '$chatPartnerObj.avatarUrl',
                        email: '$chatPartnerObj.email',
                        roles: '$chatPartnerObj.roles'
                    }
                }
            }
        ]);

        const nextCursor = conversations.length === limit
            ? conversations[conversations.length - 1].updatedAt
            : null;

        res.status(200).json({
            message: 'Lấy danh sách hội thoại đã ẩn thành công',
            data: conversations,
            pagination: { nextCursor, limit }
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
};