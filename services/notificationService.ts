import Notification from '../models/Notification';
import { NotificationType } from '../types/notification';
import { Types } from 'mongoose';

interface CreateNotificationParams {
    userId: Types.ObjectId | string;
    type: NotificationType;
    title: string;
    message: string;
    url?: string;
}

// Helper
export const createNotification = async (
    params: CreateNotificationParams
): Promise<void> => {
    try {
        await Notification.create(params);
    } catch (error) {
        console.error('Failed to create notification:', error);
    }
};

// ── ACCOUNT ────────────────────────────────────────────────
export const notifyRegistered = (userId: string) =>
    createNotification({
        userId,
        type: 'ACCOUNT',
        title: 'Đăng ký thành công',
        message: 'Đăng ký thành công! Vui lòng kiểm tra email để xác thực tài khoản.',
        url: '/profile'
    });

export const notifyLoggedIn = (userId: string) =>
    createNotification({
        userId,
        type: 'ACCOUNT',
        title: 'Đăng nhập thành công',
        message: 'Đăng nhập thành công. Chào mừng bạn trở lại!',
    });

export const notifyEmailVerified = (userId: string) =>
    createNotification({
        userId,
        type: 'ACCOUNT',
        title: 'Xác thực email thành công',
        message: 'Email của bạn đã được xác thực thành công.',
        url: '/profile'
    });

export const notifyPasswordChanged = (userId: string) =>
    createNotification({
        userId,
        type: 'ACCOUNT',
        title: 'Đổi mật khẩu thành công',
        message: 'Mật khẩu đã được đổi thành công.',
    });

export const notifyForgotPassword = (userId: string) =>
    createNotification({
        userId,
        type: 'ACCOUNT',
        title: 'Yêu cầu đặt lại mật khẩu',
        message: 'Email đặt lại mật khẩu đã được gửi. Vui lòng kiểm tra hộp thư.',
    });

export const notifyPasswordReset = (userId: string) =>
    createNotification({
        userId,
        type: 'ACCOUNT',
        title: 'Đặt lại mật khẩu thành công',
        message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại.',
        url: '/login'
    });

// ── PROFILE ────────────────────────────────────────────────
export const notifyProfileUpdated = (userId: string) =>
    createNotification({
        userId,
        type: 'PROFILE',
        title: 'Cập nhật hồ sơ thành công',
        message: 'Thông tin cá nhân đã được cập nhật thành công.',
        url: '/profile'
    });

export const notifyAddressAdded = (userId: string) =>
    createNotification({
        userId,
        type: 'PROFILE',
        title: 'Thêm địa chỉ thành công',
        message: 'Địa chỉ đã được thêm thành công.',
        url: '/profile/addresses'
    });

export const notifyAddressUpdated = (userId: string) =>
    createNotification({
        userId,
        type: 'PROFILE',
        title: 'Cập nhật địa chỉ thành công',
        message: 'Địa chỉ đã được cập nhật.',
        url: '/profile/addresses'
    });

export const notifyAddressDeleted = (userId: string) =>
    createNotification({
        userId,
        type: 'PROFILE',
        title: 'Xoá địa chỉ thành công',
        message: 'Địa chỉ đã được xoá.',
        url: '/profile/addresses'
    });

// ── LISTING ────────────────────────────────────────────────
export const notifyListingCreated = (userId: string, listingId: string) =>
    createNotification({
        userId,
        type: 'LISTING',
        title: 'Tin đăng đang chờ duyệt',
        message: 'Tin đăng đã được tạo thành công và đang chờ duyệt.',
        url: `/my-bicycles/${listingId}`
    });

export const notifyListingApproved = (userId: string, listingId: string, bikeName: string) =>
    createNotification({
        userId,
        type: 'LISTING',
        title: 'Tin đăng được duyệt',
        message: `Tin đăng "${bikeName}" đã được duyệt và hiển thị công khai.`,
        url: `/my-bicycles/${listingId}`
    });

export const notifyListingRejected = (userId: string, listingId: string, bikeName: string) =>
    createNotification({
        userId,
        type: 'LISTING',
        title: 'Tin đăng không đạt kiểm định',
        message: `Xe ${bikeName} không đạt kiểm định. Vui lòng xem chi tiết để biết thêm.`,
        url: `/my-bicycles/${listingId}`
    });

export const notifyListingDeleted = (userId: string, bikeName: string) =>
    createNotification({
        userId,
        type: 'LISTING',
        title: 'Xoá tin đăng thành công',
        message: `Bạn đã xoá ${bikeName}.`,
        url: '/my-bicycles'
    });

export const notifyListingHidden = (userId: string, bikeName: string) =>
    createNotification({
        userId,
        type: 'LISTING',
        title: 'Ẩn tin đăng thành công',
        message: `Bạn đã ẩn ${bikeName}.`,
        url: '/my-bicycles'
    });

// ── ORDER ──────────────────────────────────────────────────
export const notifyDepositSuccess = (userId: string, orderId: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Đặt cọc thành công',
        message: 'Đặt cọc thành công! Đơn hàng của bạn đang chờ xác nhận từ người bán.',
        url: `/orders/${orderId}`
    });

export const notifyPaymentSuccess = (userId: string, orderId: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Thanh toán thành công',
        message: 'Thanh toán thành công. Đơn hàng đang được xử lý.',
        url: `/orders/${orderId}`
    });

export const notifyPaymentFailed = (userId: string, orderId: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Thanh toán không thành công',
        message: 'Thanh toán không thành công. Vui lòng thử lại.',
        url: `/orders/${orderId}`
    });

export const notifyOrderConfirmed = (userId: string, orderId: string, orderCode: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Đơn hàng được xác nhận',
        message: `Đơn hàng ${orderCode} đã được người bán xác nhận.`,
        url: `/orders/${orderId}`
    });

export const notifyOrderRejected = (userId: string, orderId: string, orderCode: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Đơn hàng bị từ chối',
        message: `Đơn hàng ${orderCode} đã bị người bán từ chối.`,
        url: `/orders/${orderId}`
    });

export const notifyOrderCancelled = (userId: string, orderId: string, orderCode: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Huỷ đơn hàng thành công',
        message: `Bạn đã huỷ đơn hàng ${orderCode} thành công.`,
        url: `/orders/${orderId}`
    });

export const notifyOrderAutoExpired = (userId: string, orderId: string, orderCode: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Đơn hàng bị huỷ tự động',
        message: `Đơn hàng ${orderCode} đã hết thời gian đặt cọc và bị huỷ tự động.`,
        url: `/orders/${orderId}`
    });

export const notifySellerConfirmationTimeoutBuyer = (userId: string, orderId: string, orderCode: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Đơn hàng bị huỷ – người bán không phản hồi',
        message: `Đơn hàng ${orderCode} đã bị huỷ do người bán không xác nhận trong thời gian quy định. Số tiền của bạn sẽ được hoàn lại.`,
        url: `/orders/${orderId}`
    });

export const notifySellerConfirmationTimeoutSeller = (userId: string, orderId: string, orderCode: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Đơn hàng bị huỷ tự động',
        message: `Đơn hàng ${orderCode} đã bị huỷ tự động do bạn không xác nhận trong thời gian quy định.`,
        url: `/orders/${orderId}`
    });

export const notifyOrderReceived = (userId: string, orderId: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Xác nhận nhận hàng thành công',
        message: 'Xác nhận nhận hàng thành công. Cảm ơn bạn đã mua hàng!',
        url: `/orders/${orderId}`
    });

export const notifyReviewSubmitted = (userId: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Đánh giá thành công',
        message: 'Đánh giá của bạn đã được ghi nhận. Cảm ơn!',
    });

export const notifyReportSubmitted = (userId: string, orderId: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Báo cáo đã được gửi',
        message: 'Báo cáo của bạn đã được gửi đi và đang chờ xem xét. Chúng tôi sẽ xử lí trong thời gian sớm nhất.',
        url: `/orders/${orderId}`
    });

export const notifyDeliveryFailed = (userId: string, orderId: string, orderCode: string, failReason?: string) =>
    createNotification({
        userId,
        type: 'ORDER',
        title: 'Giao hàng không thành công',
        message: `Đơn hàng ${orderCode} giao không thành công. Lý do: ${failReason || 'Không xác định'}. Chúng tôi sẽ liên hệ để sắp xếp lại.`,
        url: `/orders/${orderId}`
    });

// ── WALLET ─────────────────────────────────────────────────
export const notifyWalletTopUpSuccess = (userId: string) =>
    createNotification({
        userId,
        type: 'WALLET',
        title: 'Nạp tiền thành công',
        message: 'Nạp tiền thành công. Số dư ví của bạn đã được cập nhật.',
        url: '/wallet'
    });

export const notifyWalletTopUpFailed = (userId: string) =>
    createNotification({
        userId,
        type: 'WALLET',
        title: 'Nạp tiền không thành công',
        message: 'Nạp tiền không thành công. Vui lòng thử lại hoặc liên hệ hỗ trợ.',
        url: '/wallet'
    });

export const notifyWithdrawRequested = (userId: string) =>
    createNotification({
        userId,
        type: 'WALLET',
        title: 'Yêu cầu rút tiền đã gửi',
        message: 'Yêu cầu rút tiền đã được gửi và đang chờ xét duyệt.',
        url: '/wallet'
    });

export const notifyWithdrawApproved = (userId: string) =>
    createNotification({
        userId,
        type: 'WALLET',
        title: 'Yêu cầu rút tiền được duyệt',
        message: 'Yêu cầu rút tiền của bạn đã được duyệt. Tiền sẽ được chuyển trong vòng 1–2 ngày làm việc.',
        url: '/wallet'
    });

export const notifyWithdrawRejected = (userId: string, reason: string) =>
    createNotification({
        userId,
        type: 'WALLET',
        title: 'Yêu cầu rút tiền bị từ chối',
        message: `Yêu cầu rút tiền bị từ chối. Lý do: ${reason}.`,
        url: '/wallet'
    });

export const notifyEscrowReleased = (userId: string, orderId: string, orderCode: string) =>
    createNotification({
        userId,
        type: 'WALLET',
        title: 'Tiền đã được giải phóng',
        message: `Tiền từ đơn hàng ${orderCode} đã được giải phóng vào ví của bạn.`,
        url: '/wallet'
    });

// ── CHAT ───────────────────────────────────────────────────
export const notifyChatLocked = (userId: string, conversationId: string) =>
    createNotification({
        userId,
        type: 'CHAT',
        title: 'Cuộc trò chuyện bị khoá',
        message: 'Cuộc trò chuyện này đã bị tạm khoá do vi phạm nội dung.',
        url: `/chat/${conversationId}`
    });

// ── SUBSCRIPTION ───────────────────────────────────────────
export const notifySubscriptionActivated = (userId: string, packageName: string) =>
    createNotification({
        userId,
        type: 'SUBSCRIPTION',
        title: 'Đăng ký gói thành công',
        message: `Bạn đã đăng ký gói ${packageName} thành công.`,
        url: '/packages'
    });

export const notifySubscriptionCancelled = (userId: string) =>
    createNotification({
        userId,
        type: 'SUBSCRIPTION',
        title: 'Huỷ gói đăng ký thành công',
        message: 'Bạn đã huỷ gói đăng ký thành công. Gói hiện tại vẫn có hiệu lực đến hết thời hạn.',
        url: '/packages'
    });

export const notifyPostLimitReached = (userId: string) =>
    createNotification({
        userId,
        type: 'SUBSCRIPTION',
        title: 'Đã đạt giới hạn tin đăng',
        message: 'Bạn đã đạt giới hạn tin đăng của gói hiện tại. Vui lòng nâng cấp để tiếp tục.',
        url: '/subscription'
    });

// ── ADMIN ───────────────────────────────────────────────────
import User from '../models/User';

const notifyAdmins = async (
    type: import('../types/notification').NotificationType,
    title: string,
    message: string,
    url: string
): Promise<void> => {
    try {
        const admins = await User.find({ roles: 'ADMIN', isActive: true }).select('_id').lean();
        if (!admins.length) return;
        await Notification.insertMany(
            admins.map(a => ({ userId: a._id, type, title, message, url }))
        );
    } catch (error) {
        console.error('Failed to notify admins:', error);
    }
};

export const notifyAdminNewListing = (bicycleId: string, sellerName: string, bicycleTitle: string) =>
    notifyAdmins(
        'LISTING',
        'Tin đăng mới cần duyệt',
        `Người dùng ${sellerName} vừa đăng tin "${bicycleTitle}". Vui lòng kiểm duyệt.`,
        '/admin/listings'
    );

export const notifyAdminInspectionRequested = (bicycleId: string, sellerName: string, bicycleTitle: string) =>
    notifyAdmins(
        'INSPECTION_REQUESTED',
        'Yêu cầu kiểm định mới',
        `Người dùng ${sellerName} yêu cầu kiểm định xe "${bicycleTitle}". Vui lòng phân công kiểm định viên.`,
        '/admin/listings'
    );

export const notifyAdminNewReport = (reportId: string, reporterName: string, bicycleTitle: string) =>
    notifyAdmins(
        'GENERAL',
        'Báo cáo vi phạm mới',
        `${reporterName} vừa gửi báo cáo vi phạm về tin đăng "${bicycleTitle}". Vui lòng xem xét.`,
        '/admin/reports'
    );

export const notifyAdminWithdrawRequest = (userName: string, amount: number) =>
    notifyAdmins(
        'WALLET',
        'Yêu cầu rút tiền mới',
        `${userName} vừa gửi yêu cầu rút ${amount.toLocaleString('vi-VN')}đ. Vui lòng xét duyệt.`,
        '/admin/withdrawals'
    );

export const notifyAdminNewDispute = (orderId: string, complainantName: string, orderCode: string) =>
    notifyAdmins(
        'GENERAL',
        'Tranh chấp đơn hàng mới',
        `${complainantName} vừa tạo tranh chấp cho đơn hàng ${orderCode}. Vui lòng xử lý.`,
        '/admin/disputes'
    );