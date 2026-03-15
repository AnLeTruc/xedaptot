import Order from '../models/Order';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
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
                let sellerWallet = await Wallet.findOne({ userId: order.seller._id });
                if (!sellerWallet) {
                    sellerWallet = await Wallet.create({ userId: order.seller._id });
                }
                if (!buyerWallet) {
                    console.error(`[RELEASE_ERROR] Buyer wallet not found for order ${order.orderCode}`);
                    continue;
                }

                const release = order.amounts.pricing.finalPrice;
                const shippingFee = order.amounts.shippingFee ?? 0;

                // Trừ frozenBalance buyer (finalPrice + shippingFee)
                buyerWallet.frozenBalance -= (release + shippingFee);
                await buyerWallet.save();

                // Cộng tiền cho seller
                sellerWallet.totalEarn += release;
                sellerWallet.totalReceived += release;
                await sellerWallet.save();

                // Tạo Transaction ESCROW_RELEASE
                const txn = await Transaction.create({
                    transactionCode: generateCode('TXN'),
                    amount: release,
                    paymentMethod: 'SYSTEM',
                    walletId: sellerWallet._id,
                    type: 'ESCROW_RELEASE',
                    balanceBefore: sellerWallet.totalEarn - release - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance,
                    balanceAfter: sellerWallet.totalEarn - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance,
                    description: `Release escrow - ${order.orderCode}`,
                    orderId: order._id,
                });

                // shipping fee là doanh thu platform
                if (shippingFee > 0) {
                    await Transaction.create({
                        transactionCode: generateCode('TXN'),
                        amount: shippingFee,
                        paymentMethod: 'SYSTEM',
                        walletId: buyerWallet._id,
                        type: 'SHIPPING_FEE',
                        balanceBefore: 0,
                        balanceAfter: 0,
                        description: `Phi giao hang cua don hang - ${order.orderCode}`,
                        orderId: order._id,
                    });
                }

                // Cập nhật Order
                order.amounts.releasedAmount = release;
                order.amounts.escrowAmount = 0;
                order.status = 'FUNDS_RELEASED' as any;
                order.fundsReleasedAt = new Date();

                order.transactions.push({
                    transactionCode: txn.transactionCode,
                    type: 'RELEASE',
                    amount: release,
                    status: 'SUCCESS',
                    createdAt: new Date(),
                    walletId: sellerWallet._id,
                    paymentMethod: 'SYSTEM',
                    balanceBefore: txn.balanceBefore,
                    balanceAfter: txn.balanceAfter,
                    description: `Release escrow - ${order.orderCode}`,
                    paymentGateway: '',
                    gatewayTransactionId: '',
                    gatewayResponseCode: '',
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
