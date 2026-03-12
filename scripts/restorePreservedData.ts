import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { readdir, readFile } from 'fs/promises';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
const COLLECTIONS_TO_RESTORE = [
    'brands',
    'packages',
    'categories',
    'bicyclemodels'
];

const getRequestedBackupDirectory = (): string | null => {
    const cliArg = process.argv[2];
    if (cliArg && cliArg.trim()) {
        return path.resolve(process.cwd(), cliArg.trim());
    }

    return null;
};

const getLatestBackupDirectory = async (): Promise<string> => {
    const backupsRoot = path.join(process.cwd(), 'backups');
    const entries = await readdir(backupsRoot, { withFileTypes: true });

    const backupDirectories = entries
        .filter(entry => entry.isDirectory() && entry.name.startsWith('preserved-'))
        .map(entry => entry.name)
        .sort()
        .reverse();

    if (backupDirectories.length === 0) {
        throw new Error('No preserved backups found in backups/');
    }

    return path.join(backupsRoot, backupDirectories[0]);
};

const restorePreservedData = async (): Promise<void> => {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }

    const backupDir = getRequestedBackupDirectory() || await getLatestBackupDirectory();

    console.log(`Using backup directory: ${backupDir}`);
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const database = mongoose.connection.db;
    if (!database) {
        throw new Error('Database connection is not initialized');
    }

    for (const collectionName of COLLECTIONS_TO_RESTORE) {
        const filePath = path.join(backupDir, `${collectionName}.json`);
        const rawContent = await readFile(filePath, 'utf8');
        const documents = JSON.parse(rawContent);

        if (!Array.isArray(documents)) {
            throw new Error(`Invalid backup format for ${collectionName}`);
        }

        await database.collection(collectionName).deleteMany({});

        if (documents.length > 0) {
            await database.collection(collectionName).insertMany(documents);
        }

        console.log(`Restored ${collectionName}: ${documents.length} documents`);
    }

    console.log('Restore completed successfully');
};

restorePreservedData()
    .catch((error) => {
        console.error('Restore failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    });