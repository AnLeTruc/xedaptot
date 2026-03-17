import { Response } from 'express';
import { AuthRequest } from '../types';
import Dispute from '../models/Dispute';
import Order from '../models/Order';
import Wallet from '../models/Wallet';
import { getOrCreateWallet } from './walletController';
import Bicycle from '../models/Bicycle';
import Transaction from '../models/Transaction';
import * as notificationService from '../services/notificationService';



const generateCode = (prefix: string) => {
    const d = new Date().toISOString().replace(/[-T:.Z]/g, '');
    return `${prefix}-${d}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
};



export const createDispute = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { orderId, disputeType, reason, evidenceImages } = req.body;

        const userId = req.user!._id;

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order không tồn tại'
            });
        }

        const isBuyer = order.buyer._id.toString() === userId.toString();
        const isSeller = order.seller._id.toString() === userId.toString();
        if (!isBuyer && !isSeller) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền tranh chấp đơn hàng này'
            });
        }


        const validStatuses = ['DELIVERED', 'WAITING_REMAINING_PAYMENT', 'COMPLETED'];
        if (!validStatuses.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: `Không thể khiếu nại vì đơn hàng đang ở trạng thái ${order.status}`
            });
        }



        const existingDispute = await Dispute.findOne({ orderId, status: { $nin: ['RESOLVED', 'REJECTED'] } });
        if (existingDispute) {
            return res.status(400).json({
                success: false,
                message: 'Đơn hàng này đã có tranh chấp rồi'
            });
        }


        const complainant = isBuyer ? order.buyer : order.seller;
        const respondent = isBuyer ? order.seller : order.buyer;

        const dispute = new Dispute({
            disputeType,
            status: 'PENDING',
            resolution: 'NONE',
            complainant: {
                _id: complainant._id,
                fullName: complainant.fullName,
                phone: complainant.phone
            },
            respondent: {
                _id: respondent._id,
                fullName: respondent.fullName,
                phone: respondent.phone
            },
            orderId,
            userId,
            reason,
            evidenceImage: evidenceImages || []
        });

        await dispute.save();

        // Mục đích là để cản thằng job "releaseFundsJob" không tự động giải ngân cái đơn này nữa.
        order.status = 'DISPUTED';
        await order.save();

        notificationService.notifyAdminNewDispute(
            order._id.toString(),
            complainant.fullName || '',
            order.orderCode
        );

        return res.status(201).json({
            success: true,
            message: 'Tạo đơn khiếu nại thành công',
            dispute
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Lỗi server'
        });
    }
}




// xem và lọc theo ng dùng
export const getDisputes = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const userId = req.user!._id;
        const role = req.user!.roles;


        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const skip = (page - 1) * limit;
        let query: any = {};
        if (!req.user!.roles.includes('ADMIN')) {
            query = { $or: [{ 'complainant._id': userId }, { 'respondent._id': userId }] };
        }

        const disputes = await Dispute.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("orderId", "orderCode amounts");
        const total = await Dispute.countDocuments(query);
        return res.status(200).json({
            success: true,
            data: disputes,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};






export const getDisputeById = async (req: AuthRequest, res: Response) => {
    try {
        const dispute = await Dispute.findById(req.params.id)
            .populate("orderId", "orderCode amounts");
        if (!dispute) return res.status(404).json({ success: false, message: 'Không tìm thấy khiếu nại' });
        return res.status(200).json({ success: true, dispute });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};




export const resolveDispute = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        const { resolution, reason } = req.body;
        const disputeId = req.params.id;
        const dispute = await Dispute.findById(disputeId);
        if (!dispute) return res.status(404).json({ success: false, message: 'Không tìm thấy khiếu nại' });
        if (dispute.status === 'RESOLVED')
            return res.status(400).json({
                success: false,
                message: 'Đã giải quyết khiếu nại'
            });


        const order = await Order.findById(dispute.orderId);
        if (!order) return res.status(404).json({
            success: false,
            message: 'Không tìm thấy đơn hàng'
        });

        const escrowAmount = order.amounts.escrowAmount || 0;
        // người mua thắng khiếu nại
        if (resolution === 'REFUND_BUYER') {
            const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
            if (!buyerWallet) return res.status(404).json({
                success: false,
                message: 'Không tìm thấy ví người mua'
            });

            if (buyerWallet && escrowAmount > 0) {
                const balBefore = buyerWallet.totalEarn - buyerWallet.totalWithdrawn - buyerWallet.frozenBalance;
                buyerWallet.frozenBalance -= escrowAmount;
                await buyerWallet.save();
                await Transaction.create({
                    walletId: buyerWallet._id,
                    type: 'REFUND',
                    amount: escrowAmount,
                    orderId: order._id,
                    balanceBefore: balBefore,
                    balanceAfter: balBefore + escrowAmount,
                    paymentMethod: 'SYSTEM',
                    transactionCode: generateCode('REFUND'),
                    description: reason || 'Hoàn tiền tranh chấp đơn đặt xe ' + order.orderCode,
                });
            }

            order.status = 'CANCELLED';
            order.cancelledAt = new Date();
            order.cancelReason = reason || 'Đơn hủy do Admin phán quyết khiếu nại (hoàn tiền cho người mua)';
            order.amounts.escrowAmount = 0;

            await Bicycle.findByIdAndUpdate(order.bicycle._id, { status: 'SOLD' });


            // người bán thắng
        } else if (resolution === 'RELEASE_SELLER') {
            const buyerWallet = await Wallet.findOne({ userId: order.buyer._id });
            const sellerRelease = order.amounts.pricing.finalPrice;
            const shippingFee = order.amounts.shippingFee ?? 0;

            if (buyerWallet) {
                buyerWallet.frozenBalance -= (sellerRelease + shippingFee);
                await buyerWallet.save();
            }

            const sellerWallet = await getOrCreateWallet(order.seller._id);
            if (sellerRelease > 0) {
                const sellerBalBefore = sellerWallet.totalEarn - sellerWallet.totalWithdrawn - sellerWallet.frozenBalance;
                sellerWallet.totalEarn += sellerRelease;
                sellerWallet.totalReceived += sellerRelease;
                await sellerWallet.save();
                await Transaction.create({
                    walletId: sellerWallet._id,
                    type: 'ESCROW_RELEASE',
                    amount: sellerRelease,
                    orderId: order._id,
                    balanceBefore: sellerBalBefore,
                    balanceAfter: sellerBalBefore + sellerRelease,
                    paymentMethod: 'SYSTEM',
                    transactionCode: generateCode('EARN'),
                    description: 'Nhận tiền từ khiếu nại ' + order.orderCode,
                });
            }

            // Phí ship về doanh thu platform
            if (shippingFee > 0) {
                await Transaction.create({
                    walletId: buyerWallet!._id,
                    type: 'SHIPPING_FEE',
                    amount: shippingFee,
                    orderId: order._id,
                    balanceBefore: 0,
                    balanceAfter: 0,
                    paymentMethod: 'SYSTEM',
                    transactionCode: generateCode('SHIP'),
                    description: 'Tien giao hang ve he thong cho don - ' + order.orderCode,
                });
            }
            // ĐƠN GIAO THÀNH CÔNG ( HOÀN TẤT THU TIỀN )
            order.status = 'FUNDS_RELEASED';
            order.amounts.escrowAmount = 0;

            // hòa giải (rút đơn)
        } else if (resolution === 'NONE') {
            order.status = 'DELIVERED';
        }
        await order.save();
        dispute.status = 'RESOLVED';
        dispute.resolvedAt = new Date();
        dispute.resolution = resolution;
        await dispute.save();
        return res.status(200).json({
            success: true,
            message: 'Đã giải quyết khiếu nại',
            dispute
        });

    } catch (error: any) {
        return res.status(500).json({
            success: false,
            message: error.message || 'Lỗi server'
        })
    }
}