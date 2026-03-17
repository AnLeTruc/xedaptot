import Order from '../models/Order';
import Wallet from '../models/Wallet';
import Transaction from '../models/Transaction';
import Bicycle from '../models/Bicycle';
import { ORDER_TIMEOUTS } from '../types/order';
import {
    notifySellerConfirmationTimeoutBuyer,
    notifySellerConfirmationTimeoutSeller,
} from '../services/notificationService';

const generateCode = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

/**
 * Cronjob: Tự động huỷ đơn WAITING_SELLER_CONFIRMATION sau 48h
 * Set bicycle → VIOLATED
 */
export const sellerConfirmationTimeoutJob = async () => {
    try {
        const threshold = new Date(Date.now() - ORDER_TIMEOUTS.SELLER_CONFIRMATION);

        const orders = await Order.find({
            status: 'WAITING_SELLER_CONFIRMATION',
            updatedAt: { $lte: threshold },
        });

        if (orders.length === 0) return;
        console.log(`[SELLER_TIMEOUT_JOB] Found ${orders.length} orders awaiting seller confirmation`);

        for (const order of orders) {
            try {
                const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
                if (!buyerWallet) {
                    console.error(`[SELLER_TIMEOUT_ERROR] Buyer wallet not found for order ${order.orderCode}`);
                    continue;
                }

                const escrowAmount = order.amounts.escrowAmount ?? 0;
                // Ship chỉ bị freeze khi FULL_100 (buyer đã trả toàn bộ)
                const shippingFee = order.paymentType === 'FULL_100' ? (order.amounts.shippingFee ?? 0) : 0;
                const totalRefund = escrowAmount + shippingFee;

                if (totalRefund > 0) {
                    const balBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
                    buyerWallet.frozenBalance -= totalRefund;
                    await buyerWallet.save();

                    const txnCode = generateCode('REFUND');
                    await Transaction.create({
                        transactionCode: txnCode,
                        amount: totalRefund,
                        paymentMethod: 'SYSTEM',
                        walletId: buyerWallet._id,
                        type: 'REFUND',
                        balanceBefore: balBefore,
                        balanceAfter: balBefore + totalRefund,
                        description: `Hoàn tiền do người bán không xác nhận - ${order.orderCode}`,
                        orderId: order._id,
                    });

                    order.transactions.push({
                        transactionCode: txnCode,
                        type: 'REFUND',
                        amount: totalRefund,
                        status: 'SUCCESS',
                        createdAt: new Date(),
                        walletId: buyerWallet._id,
                        paymentMethod: 'SYSTEM',
                        balanceBefore: balBefore,
                        balanceAfter: balBefore + totalRefund,
                        description: `Hoàn tiền do người bán không xác nhận - ${order.orderCode}`,
                        paymentGateway: '',
                        gatewayTransactionId: '',
                        gatewayResponseCode: '',
                    } as any);
                }

                order.amounts.escrowAmount = 0;
                order.status = 'REJECTED';
                order.cancelledAt = new Date();
                order.cancelReason = 'Đơn hàng bị huỷ tự động do người bán không xác nhận trong 48 giờ';
                await order.save();

                await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'VIOLATED' });

                notifySellerConfirmationTimeoutBuyer(
                    order.buyer._id.toString(),
                    order._id.toString(),
                    order.orderCode,
                );
                notifySellerConfirmationTimeoutSeller(
                    order.seller._id.toString(),
                    order._id.toString(),
                    order.orderCode,
                );

                console.log(`[SELLER_TIMEOUT] Order ${order.orderCode}: refunded ${totalRefund}đ → Buyer ${order.buyer._id}`);
            } catch (error: any) {
                console.error(`[SELLER_TIMEOUT_ERROR] Order ${order.orderCode}: ${error.message}`);
            }
        }

        console.log(`[SELLER_TIMEOUT_JOB] Completed: ${orders.length} orders processed`);
    } catch (error: any) {
        console.error(`[SELLER_TIMEOUT_JOB_FATAL] ${error.message}`);
    }
};
