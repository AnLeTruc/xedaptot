import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import User from '../models/User';

//Auth firebase
const { auth } = require('../config/firebase');

let io: Server;

export const onlineUsers = new Map<string, Set<string>>();

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
    io.on('connection', async (socket: Socket) => {
        const user = (socket as any).user;
        const userId = user._id.toString();

        console.log(`User connected to socket: ${userId}`);

        //User join own id room
        socket.join(userId);
        console.log(`User ${userId} joined room: ${userId}`);

        // Add to online map
        const existingSockets = onlineUsers.get(userId) || new Set<string>();
        existingSockets.add(socket.id);
        onlineUsers.set(userId, existingSockets);
        if (existingSockets.size === 1) {
            await User.findByIdAndUpdate(userId, { isOnline: true });
            io.emit('user_online', { userId: userId });
        }


        //Listen user typing
        socket.on('typing', (data: { receiverId: string; conversationId: string }) => {
            if (!data || !data.receiverId) return;

            //Send typping
            socket.to(data.receiverId).emit('typing', {
                conversationId: data.conversationId,
                senderId: userId
            });
        });

        //Listen user stop typing
        socket.on('stop_typing', (data: { receiverId: string; conversationId: string }) => {
            if (!data || !data.receiverId) return;

            socket.to(data.receiverId).emit('stop_typing', {
                conversationId: data.conversationId,
                senderId: userId
            });
        });

        // Handle disconnect
        socket.on('disconnect', async () => {
            console.log(`User disconnected from socket: ${userId}`);

            const sockets = onlineUsers.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    onlineUsers.delete(userId);
                    await User.findByIdAndUpdate(userId, {
                        isOnline: false,
                        lastActiveAt: new Date()
                    });

                    io.emit('user_offline', { userId: userId, lastActiveAt: new Date() });
                } else {
                    onlineUsers.set(userId, sockets);
                }
            }
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