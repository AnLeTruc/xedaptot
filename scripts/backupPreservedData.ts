import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
const COLLECTIONS_TO_BACKUP = [
    'brands',
    'packages',
    'categories',
    'bicyclemodels'
];

const createTimestamp = (): string => {
    const now = new Date();
    const pad = (value: number): string => String(value).padStart(2, '0');

    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate())
    ].join('') + '-' + [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join('');
};

const backupPreservedData = async (): Promise<void> => {
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

    const backupDir = path.join(process.cwd(), 'backups', `preserved-${createTimestamp()}`);
    await mkdir(backupDir, { recursive: true });

    for (const collectionName of COLLECTIONS_TO_BACKUP) {
        const documents = await database.collection(collectionName).find({}).toArray();
        const outputPath = path.join(backupDir, `${collectionName}.json`);

        await writeFile(outputPath, JSON.stringify(documents, null, 2), 'utf8');
        console.log(`Backed up ${collectionName}: ${documents.length} documents -> ${outputPath}`);
    }

    console.log(`Backup completed successfully: ${backupDir}`);
};

backupPreservedData()
    .catch((error) => {
        console.error('Backup failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    });