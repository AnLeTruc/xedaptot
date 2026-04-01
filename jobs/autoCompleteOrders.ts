import Order from '../models/Order';
import { ORDER_TIMEOUTS } from '../types/order';
import { sendToUser } from '../services/pushNotificationService';

/**
 * Cronjob: Tự động chuyển đơn hàng từ DELIVERED sang COMPLETED sau 48h 
 * nếu người mua (buyer) không bấm "Đã nhận được hàng".
 */
export const autoCompleteOrdersJob = async () => {
    try {
        const threshold = new Date(Date.now() - ORDER_TIMEOUTS.AUTO_COMPLETE);

        // Tìm các đơn hàng đã được DELIVERED và thời điểm giao hàng (deliveredAt) quá 48h
        const orders = await Order.find({
            status: 'DELIVERED',
            'deliveryProof.deliveredAt': { $lte: threshold }
        });

        if (orders.length > 0) {
            console.log(`[AUTO_COMPLETE_JOB] Found ${orders.length} orders ready to autocomplete`);
        }

        for (const order of orders) {
            try {
                // Ép tự động chốt đơn
                order.status = 'COMPLETED' as any;
                order.completedAt = new Date();
                order.buyerConfirmedAt = new Date(); // Coi như hệ thống bấm thay người mua
                
                // Lưu lại
                await order.save();

                // Gửi thông báo báo cho người bán biết tiền sắp rụng về ví
                sendToUser(order.seller._id.toString(), {
                    title: 'Đơn hàng tự động thành công',
                    body: `Đơn hàng ${order.orderCode} đã được hệ thống xác nhận hoàn thành. Tiền sẽ được giải ngân trong 48h nữa!`,
                    data: { type: 'ORDER_AUTO_COMPLETED', orderId: order._id.toString() }
                }).catch(err => console.error('[FCM] autoComplete push error:', err));

                // Báo cho người mua biết
                sendToUser(order.buyer._id.toString(), {
                    title: 'Đơn hàng tự động xác nhận',
                    body: `Đơn hàng ${order.orderCode} đã tự động xác nhận do hết thời hạn khiếu nại.`,
                    data: { type: 'ORDER_AUTO_COMPLETED', orderId: order._id.toString() }
                }).catch(err => console.error('[FCM] autoComplete push error:', err));

                console.log(`[AUTO_COMPLETE] Order ${order.orderCode} moved to COMPLETED`);
            } catch (err: any) {
                console.error(`[AUTO_COMPLETE_ERROR] Order ${order.orderCode}: ${err.message}`);
            }
        }
    } catch (error: any) {
        console.error(`[AUTO_COMPLETE_JOB_FATAL] ${error.message}`);
    }
};
