import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User';

dotenv.config();

const { auth } = require('../config/firebase');

const MONGODB_URI = process.env.MONGODB_URI || '';
const ADMIN_EMAIL = 'xedaptot.contact@gmail.com';
const ADMIN_PASSWORD = 'Xedaptot@123';
const ADMIN_FULL_NAME = 'Xedaptot Admin';
const PRESERVED_COLLECTIONS = new Set([
    'brands',
    'packages',
    'categories',
    'bicyclemodels'
]);

const cleanDatabase = async (): Promise<void> => {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const database = mongoose.connection.db;
    if (!database) {
        throw new Error('Database connection is not initialized');
    }

    const collections = await database.listCollections().toArray();
    const cleanedCollections: string[] = [];
    const preservedCollections: string[] = [];

    for (const collection of collections) {
        const collectionName = collection.name;

        if (collectionName.startsWith('system.')) {
            continue;
        }

        if (PRESERVED_COLLECTIONS.has(collectionName)) {
            preservedCollections.push(collectionName);
            continue;
        }

        await database.collection(collectionName).deleteMany({});
        cleanedCollections.push(collectionName);
    }

    console.log(`Preserved collections: ${preservedCollections.join(', ') || 'none'}`);
    console.log(`Cleaned collections: ${cleanedCollections.join(', ') || 'none'}`);

    let firebaseUser;
    try {
        firebaseUser = await auth.getUserByEmail(ADMIN_EMAIL);
        firebaseUser = await auth.updateUser(firebaseUser.uid, {
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            displayName: ADMIN_FULL_NAME,
            emailVerified: true,
            disabled: false
        });
        console.log(`Updated Firebase admin user: ${ADMIN_EMAIL}`);
    } catch (error: any) {
        if (error?.code !== 'auth/user-not-found') {
            throw error;
        }

        firebaseUser = await auth.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            displayName: ADMIN_FULL_NAME,
            emailVerified: true,
            disabled: false
        });
        console.log(`Created Firebase admin user: ${ADMIN_EMAIL}`);
    }

    const adminUser = await User.findOneAndUpdate(
        { email: ADMIN_EMAIL },
        {
            $set: {
                firebaseUId: firebaseUser.uid,
                email: ADMIN_EMAIL,
                fullName: ADMIN_FULL_NAME,
                roles: ['ADMIN'],
                isVerified: true,
                isActive: true,
                authProvider: 'email'
            }
        },
        {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        }
    );

    console.log(`Mongo admin user ready: ${adminUser.email}`);
    console.log('Database cleanup completed successfully');
};

cleanDatabase()
    .catch((error) => {
        console.error('Database cleanup failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    });