import Order from '../models/Order';
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
                // TODO: Khi implement Wallet, uncomment phần này
                // const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
                // let sellerWallet = await Wallet.findOne({ userId: order.seller._id });
                // if (!sellerWallet) {
                //     sellerWallet = await new Wallet({ 
                //         userId: order.seller._id, 
                //         balance: 0, 
                //         frozenBalance: 0 
                //     }).save();
                // }

                const release = order.amounts.pricing.finalPrice; // Seller nhận 100%
                
                // TODO: Chuyển tiền từ frozenBalance -> sellerWallet
                // if (buyerWallet) {
                //     buyerWallet.frozenBalance -= release;
                //     await buyerWallet.save();
                // }
                // sellerWallet.balance += release;
                // await sellerWallet.save();

                // Cập nhật Order
                order.amounts.releasedAmount = release;
                order.amounts.escrowAmount = 0;
                order.status = 'FUNDS_RELEASED' as any;
                order.fundsReleasedAt = new Date();
                
                // TODO: Log transaction
                // order.transactions.push({
                //     transactionCode: generateCode('TXN'), 
                //     type: 'RELEASE', 
                //     amount: release, 
                //     status: 'SUCCESS',
                //     createdAt: new Date(), 
                //     walletId: sellerWallet._id, 
                //     paymentMethod: 'SYSTEM',
                //     balanceBefore: sellerWallet.balance - release, 
                //     balanceAfter: sellerWallet.balance,
                //     description: `Release tiền cho Seller - ${order.orderCode}`, 
                //     paymentGateway: '', 
                //     gatewayTransactionId: '', 
                //     gatewayResponseCode: ''
                // } as any);
                
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
