import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import User from '../models/User';

//Auth firebase
const { auth } = require('../config/firebase');

let io: Server;

export const initSocketServer = (server: HttpServer) => {
    io = new Server(server, {
        cors: {
            origin: '*',
            methods: ["GET", "POST"],
        }
    });

    //Auth socket
    io.use(async (socket: Socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error('Authentication error: Missing token'));
            }

            //Verify token 
            const decodedToken = await auth.verifyIdToken(token);

            const user = await User.findOne({
                firebaseUId: decodedToken.uid
            });
            if (!user) {
                return next(new Error('Authentication error: User not found in system'));
            }

            //User in4 -> socket object
            (socket as any).user = user;
            next();
        } catch (error) {
            next(new Error('Authentication error: Invalid Token'));
        }
    });

    //Room mapping
    io.on('connection', (socket: Socket) => {
        const user = (socket as any).user;

        console.log(`User connected to socket: ${user._id}`);

        //User join own id room
        socket.join(user._id.toString());
        console.log(`User ${user._id} joined room: ${user._id}`);

        //Listen user typing
        socket.on('typing', (data: { receiverId: string; conversationId: string }) => {
            if (!data || !data.receiverId) return;

            //Send typping
            socket.to(data.receiverId).emit('typing', {
                conversationId: data.conversationId,
                senderId: user._id.toString()
            });
        });

        //Listen user stop typing
        socket.on('stop_typing', (data: { receiverId: string; conversationId: string }) => {
            if (!data || !data.receiverId) return;

            socket.to(data.receiverId).emit('stop_typing', {
                conversationId: data.conversationId,
                senderId: user._id.toString()
            });
        });
    });
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io is not initialized!');
    }
    return io;
}