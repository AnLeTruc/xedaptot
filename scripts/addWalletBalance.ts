import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import User from '../models/User';

dotenv.config();

const { auth } = require('../config/firebase');

const MONGODB_URI = process.env.MONGODB_URI || '';

const generateTransactionCode = (prefix: string) => {
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '');
    const randomSuffix = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    return `${prefix}-${timestamp}-${randomSuffix}`;
};

const getOrCreateWallet = async (userId: mongoose.Types.ObjectId) => {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = await Wallet.create({ userId });
    }
    return wallet;
};

const parseArgs = () => {
    const [, , idTokenArg, amountArg] = process.argv;
    const idToken = idTokenArg || process.env.WALLET_ADD_ID_TOKEN || '';
    const amount = Number(amountArg || process.env.WALLET_ADD_AMOUNT || '0');

    if (!idToken) {
        throw new Error('Missing Firebase ID token. Usage: npm run wallet:add-balance -- "<ID_TOKEN>" 50000');
    }

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Amount must be a positive number. Usage: npm run wallet:add-balance -- "<ID_TOKEN>" 50000');
    }

    return { idToken, amount };
};

const addWalletBalance = async () => {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is required');
    }

    const { idToken, amount } = parseArgs();

    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const decodedToken = await auth.verifyIdToken(idToken);
    const firebaseUid = decodedToken.uid;
    const email = decodedToken.email || '';

    const user = await User.findOne({
        $or: [
            { firebaseUId: firebaseUid },
            ...(email ? [{ email: email.toLowerCase() }] : [])
        ]
    });

    if (!user) {
        throw new Error(`User not found in MongoDB for Firebase UID ${firebaseUid}${email ? ` or email ${email}` : ''}`);
    }

    const wallet = await getOrCreateWallet(user._id as mongoose.Types.ObjectId);
    const balanceBefore = wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance;

    wallet.totalEarn += amount;
    wallet.totalReceived += amount;
    await wallet.save();

    const transaction = await Transaction.create({
        transactionCode: generateTransactionCode('ADMDEP'),
        paymentMethod: 'SYSTEM',
        walletId: wallet._id,
        type: 'DEPOSIT',
        amount,
        balanceBefore,
        balanceAfter: balanceBefore + amount,
        description: `Manual wallet top-up via script for ${user.email}`,
        paymentGateway: 'MANUAL_ADJUSTMENT',
        gatewayTransactionId: decodedToken.uid,
        gatewayResponseCode: 'SUCCESS',
        data: {
            status: 'SUCCESS',
            source: 'script:addWalletBalance',
            firebaseUid,
            email
        }
    });

    console.log('Wallet balance added successfully');
    console.log(`User: ${user.email}`);
    console.log(`Wallet ID: ${wallet._id}`);
    console.log(`Added amount: ${amount}`);
    console.log(`Available balance before: ${balanceBefore}`);
    console.log(`Available balance after: ${wallet.totalEarn - wallet.totalWithdrawn - wallet.frozenBalance}`);
    console.log(`Transaction ID: ${transaction._id}`);
    console.log(`Transaction code: ${transaction.transactionCode}`);
}

addWalletBalance()
    .catch((error) => {
        console.error('Add wallet balance failed:', error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    });