import { Response } from 'express';
import { AuthRequest } from '../types';
import Dispute from '../models/Dispute';
import Order from '../models/Order';
import Wallet from '../models/Wallet';
import { getOrCreateWallet } from './walletController';
import Bicycle from '../models/Bicycle';
import Transaction from '../models/Transaction';



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
            .limit(limit);
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
        const dispute = await Dispute.findById(req.params.id);
        if (!dispute) return res.status(404).json({ success: false, message: 'Không tìm thấy khiếu nại' });
        return res.status(200).json({ success: true, dispute });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Lỗi server' });
    }
};