const mongoose = require('mongoose');
const { initRestrictedWordCache } = require('../services/restrictedWordCache');

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);

        await initRestrictedWordCache();
        console.log('Restricted word cache initialized');

        //Connection event
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected');
        });
    } catch (err) {
        console.error(`MongoDB connection error: ${err.message}`);
        process.exit(1);
    }
}

module.exports = connectDB;