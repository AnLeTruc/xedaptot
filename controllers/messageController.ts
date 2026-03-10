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
        conversation.lastMessage = newMessage._id;

        await Promise.all([
            newMessage.save(),
            conversation.save()
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