import cron from 'node-cron';
import Order from '../models/Order';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import Bicycle from '../models/Bicycle';

// Helper function
const generateCode = (prefix: string) => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

export const cleanupExpiredOrdersJob = async () => {
    try {
        const now = new Date();

        // Find orders that are reserved or deposit confirmed, and expired
        const expiredOrders = await Order.find({
            status: { $in: ['RESERVED_FULL', 'RESERVED_DEPOSIT', 'DEPOSIT_CONFIRMED'] },
            reservationExpiresAt: { $lt: now }
        });

        if (expiredOrders.length === 0) return;
        console.log(`[CLEANUP_JOB] Found ${expiredOrders.length} expired orders`);

        for (const order of expiredOrders) {
            try {
                // If there's money in escrow, forfeit it to seller
                if (order.amounts.escrowAmount > 0) {
                    const forfeit = order.amounts.escrowAmount;
                    const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });

                    let sellerWallet = await Wallet.findOne({ userId: order.seller._id });
                    if (!sellerWallet) {
                        sellerWallet = await Wallet.create({ userId: order.seller._id });
                    }

                    if (buyerWallet && sellerWallet) {
                        const sellerBalBefore = sellerWallet.totalEarn - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance;
                        buyerWallet.frozenBalance -= forfeit;
                        sellerWallet.totalReceived += forfeit;
                        sellerWallet.totalEarn += forfeit;
                        await buyerWallet.save();
                        await sellerWallet.save();

                        const txnCode = generateCode('TXN');
                        await Transaction.create({
                            transactionCode: txnCode,
                            paymentMethod: 'SYSTEM',
                            walletId: sellerWallet._id,
                            type: 'FORFEIT',
                            amount: forfeit,
                            balanceBefore: sellerBalBefore,
                            balanceAfter: sellerBalBefore + forfeit,
                            description: `Reservation expired, deposit forfeited - ${order.orderCode}`,
                            orderId: order._id,
                        });

                        order.transactions.push({
                            transactionCode: txnCode, type: 'FORFEIT', amount: forfeit, status: 'SUCCESS',
                            createdAt: new Date(), walletId: sellerWallet._id, paymentMethod: 'SYSTEM',
                            balanceBefore: sellerBalBefore, balanceAfter: sellerBalBefore + forfeit,
                            description: `Reservation expired, deposit forfeited - ${order.orderCode}`,
                            paymentGateway: '', gatewayTransactionId: '', gatewayResponseCode: ''
                        } as any);
                    }
                    order.amounts.escrowAmount = 0;
                }

                // Update order status
                order.status = order.paymentType === 'FULL_100' ? 'PAYMENT_TIMEOUT' : 'DEPOSIT_EXPIRED';

                // Release bicycle back to market
                await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'APPROVED' });

                await order.save();
                console.log(`[CLEANUP_JOB] Order ${order.orderCode} expired and handled`);

            } catch (err: any) {
                console.error(`[CLEANUP_JOB_ERROR] Order ${order.orderCode}: ${err.message}`);
            }
        }
    } catch (error: any) {
        console.error(`[CLEANUP_JOB_FATAL] ${error.message}`);
    }
};
