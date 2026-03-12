import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || '';
const AFFECTED_COLLECTIONS = ['brands', 'bicyclemodels', 'bicycles'] as const;

const hasFlag = (flag: string): boolean => process.argv.includes(flag);

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

const isValidObjectIdHex = (value: unknown): value is string => {
    return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
};

type RawBrandDocument = {
    _id: unknown;
    name?: string;
    [key: string]: unknown;
};

type RawObjectIdBrandDocument = RawBrandDocument & {
    _id: mongoose.Types.ObjectId;
};

const getStringId = (document: RawBrandDocument): string => {
    if (typeof document._id !== 'string') {
        throw new Error('Expected brand _id to be a string during migration');
    }

    return document._id;
};

const backupCollections = async (database: mongoose.mongo.Db): Promise<string> => {
    const backupDir = path.join(process.cwd(), 'backups', `brand-id-migration-${createTimestamp()}`);
    await mkdir(backupDir, { recursive: true });

    for (const collectionName of AFFECTED_COLLECTIONS) {
        const documents = await database.collection(collectionName).find({}).toArray();
        const outputPath = path.join(backupDir, `${collectionName}.json`);

        await writeFile(outputPath, JSON.stringify(documents, null, 2), 'utf8');
        console.log(`Backed up ${collectionName}: ${documents.length} documents -> ${outputPath}`);
    }

    return backupDir;
};

const migrateBrandIds = async (): Promise<void> => {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }

    const applyChanges = hasFlag('--apply');
    const dryRun = !applyChanges;
    const skipBackup = hasFlag('--no-backup');

    console.log(`Connecting to MongoDB${dryRun ? ' (dry-run)' : ''}...`);
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const database = mongoose.connection.db;
    if (!database) {
        throw new Error('Database connection is not initialized');
    }

    const brandsCollection = database.collection('brands');
    const bicycleModelsCollection = database.collection('bicyclemodels');
    const bicyclesCollection = database.collection('bicycles');

    const brandDocuments = await brandsCollection.find({}).toArray() as RawBrandDocument[];
    const stringIdBrands = brandDocuments.filter((document): document is RawBrandDocument => typeof document._id === 'string');
    const invalidStringIds = stringIdBrands
        .map((document) => getStringId(document))
        .filter((value) => !isValidObjectIdHex(value));

    if (invalidStringIds.length > 0) {
        throw new Error(`Found brand _id values that are not valid 24-char hex strings: ${invalidStringIds.join(', ')}`);
    }

    const targetIdHexes = new Set(stringIdBrands.map((document) => getStringId(document)));
    const conflictingObjectIdBrands = brandDocuments.filter(
        (document): document is RawObjectIdBrandDocument => document._id instanceof mongoose.Types.ObjectId
    ).filter((document) => targetIdHexes.has(document._id.toHexString()));

    if (conflictingObjectIdBrands.length > 0) {
        throw new Error(
            `Migration aborted because matching ObjectId brands already exist: ${conflictingObjectIdBrands
                .map((document) => document._id.toHexString())
                .join(', ')}`
        );
    }

    const bikeModelBrandCounts = await Promise.all(
        stringIdBrands.map(async (document) => ({
            id: getStringId(document),
            count: await bicycleModelsCollection.countDocuments({ 'brand._id': getStringId(document) })
        }))
    );

    const bicycleBrandCounts = await Promise.all(
        stringIdBrands.map(async (document) => ({
            id: getStringId(document),
            count: await bicyclesCollection.countDocuments({ 'brand._id': getStringId(document) })
        }))
    );

    console.log(`Found ${brandDocuments.length} brands total`);
    console.log(`Found ${stringIdBrands.length} brands with string _id`);
    console.log(`Found ${bikeModelBrandCounts.reduce((sum, item) => sum + item.count, 0)} bicyclemodels referencing string brand._id`);
    console.log(`Found ${bicycleBrandCounts.reduce((sum, item) => sum + item.count, 0)} bicycles referencing string brand._id`);

    if (stringIdBrands.length === 0) {
        console.log('No string brand _id values found. Nothing to migrate.');
        return;
    }

    if (dryRun) {
        console.log('Preview summary:');
        for (const brand of stringIdBrands) {
            const brandId = getStringId(brand);
            const bikeModelRefs = bikeModelBrandCounts.find((item) => item.id === brandId)?.count ?? 0;
            const bicycleRefs = bicycleBrandCounts.find((item) => item.id === brandId)?.count ?? 0;
            console.log(`- ${brand.name ?? 'Unknown'}: ${brandId} -> ObjectId(${brandId}), bicyclemodels=${bikeModelRefs}, bicycles=${bicycleRefs}`);
        }
        console.log('No changes were written. Re-run with --apply to execute the migration.');
        return;
    }

    let backupDir: string | null = null;
    if (!skipBackup) {
        backupDir = await backupCollections(database);
        console.log(`Backup completed: ${backupDir}`);
    } else {
        console.log('Skipping backup because --no-backup was provided');
    }

    const session = await mongoose.startSession();

    try {
        await session.withTransaction(async () => {
            for (const brand of stringIdBrands) {
                const oldId = getStringId(brand);
                const newId = new mongoose.Types.ObjectId(oldId);

                const migratedBrand = {
                    ...brand,
                    _id: newId
                };

                await brandsCollection.deleteOne({ _id: oldId } as any, { session });
                await brandsCollection.insertOne(migratedBrand, { session });

                await bicycleModelsCollection.updateMany(
                    { 'brand._id': oldId },
                    { $set: { 'brand._id': newId } },
                    { session }
                );

                await bicyclesCollection.updateMany(
                    { 'brand._id': oldId },
                    { $set: { 'brand._id': newId } },
                    { session }
                );

                console.log(`Migrated brand ${brand.name ?? 'Unknown'}: ${oldId} -> ${newId.toHexString()}`);
            }
        });

        console.log('Brand ID migration completed successfully');
        if (backupDir) {
            console.log(`Backup directory: ${backupDir}`);
        }
    } finally {
        await session.endSession();
    }
};

migrateBrandIds()
    .catch((error) => {
        console.error('Brand ID migration failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    });