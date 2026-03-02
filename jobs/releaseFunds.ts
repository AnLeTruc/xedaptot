import Order from '../models/Order';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import { getOrCreateWallet } from '../controllers/walletController';
import { ORDER_TIMEOUTS } from '../types/order';

// Helper function để generate transaction code
const generateCode = (prefix: string) => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
};

/**
 * Cronjob: Tự động release funds cho Seller sau 48h buyer confirm
 * Chạy mỗi giờ để kiểm tra các đơn hàng đủ điều kiện
 */
export const releaseFundsJob = async () => {
    try {
        const threshold = new Date(Date.now() - ORDER_TIMEOUTS.FUNDS_RELEASE);

        // Tìm các đơn COMPLETED, đã confirm >= 48h, còn tiền trong escrow
        const orders = await Order.find({
            status: 'COMPLETED',
            buyerConfirmedAt: { $lte: threshold },
            'amounts.escrowAmount': { $gt: 0 },
        });

        console.log(`[RELEASE_FUNDS_JOB] Found ${orders.length} orders ready for release`);

        for (const order of orders) {
            try {
                const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
                const sellerWallet = await getOrCreateWallet(order.seller._id);

                const release = order.amounts.escrowAmount;

                // Chuyển tiền: buyer.frozenBalance → seller.totalEarn
                if (buyerWallet) {
                    buyerWallet.frozenBalance -= release;
                    await buyerWallet.save();
                }

                const sellerBalBefore = sellerWallet.totalEarn - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance;
                sellerWallet.totalReceived += release;
                sellerWallet.totalEarn += release;
                await sellerWallet.save();

                // Tạo Transaction record
                await Transaction.create({
                    transactionCode: generateCode('TXN'),
                    paymentMethod: 'SYSTEM',
                    walletId: sellerWallet._id,
                    type: 'ESCROW_RELEASE',
                    amount: release,
                    balanceBefore: sellerBalBefore,
                    balanceAfter: sellerBalBefore + release,
                    description: `Release funds to Seller - ${order.orderCode}`,
                    orderId: order._id,
                });

                // Cập nhật Order
                order.amounts.releasedAmount = release;
                order.amounts.escrowAmount = 0;
                order.status = 'FUNDS_RELEASED' as any;
                order.fundsReleasedAt = new Date();

                order.transactions.push({
                    transactionCode: generateCode('TXN'),
                    type: 'ESCROW_RELEASE',
                    amount: release,
                    status: 'SUCCESS',
                    createdAt: new Date(),
                    walletId: sellerWallet._id,
                    paymentMethod: 'SYSTEM',
                    balanceBefore: sellerBalBefore,
                    balanceAfter: sellerBalBefore + release,
                    description: `Release funds to Seller - ${order.orderCode}`,
                    paymentGateway: '',
                    gatewayTransactionId: '',
                    gatewayResponseCode: ''
                } as any);

                await order.save();

                console.log(`[RELEASE] Order ${order.orderCode}: ${release}đ → Seller ${order.seller._id}`);
            } catch (error: any) {
                console.error(`[RELEASE_ERROR] Order ${order.orderCode}: ${error.message}`);
            }
        }

        console.log(`[RELEASE_FUNDS_JOB] Completed: ${orders.length} orders processed`);
    } catch (error: any) {
        console.error(`[RELEASE_FUNDS_JOB_ERROR] ${error.message}`);
    }
};

