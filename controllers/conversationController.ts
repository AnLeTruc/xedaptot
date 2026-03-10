import { Request, Response } from "express";
import Conversation from "../models/Conversation";
import User from "../models/User";

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