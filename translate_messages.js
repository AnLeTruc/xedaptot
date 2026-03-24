// Script to translate remaining English messages in controller files to Vietnamese
const fs = require('fs');
const path = require('path');

const translations = {
  // Order - remaining
  "'Bicycle is not available'": "'Xe đạp không khả dụng'",
  "'Cannot purchase your own bicycle'": "'Không thể mua xe đạp của chính bạn'",
  "'Seller not found'": "'Không tìm thấy người bán'",
  "'Bicycle is already reserved or pending payment'": "'Xe đạp đã được đặt hoặc đang chờ thanh toán'",
  "'Reservation has expired'": "'Đặt chỗ đã hết hạn'",
  "'Insufficient balance'": "'Số dư không đủ'",
  "'You do not have permission to view this order'": "'Bạn không có quyền xem đơn hàng này'",
  "'Request timed out, please try again'": "'Yêu cầu đã hết thời gian, vui lòng thử lại'",
  "'Permission denied'": "'Không có quyền thực hiện'",
  "'Funds will be released to seller after 48 hours'": "'Tiền sẽ được giải phóng cho người bán sau 48 giờ'",
  "'Can only review completed orders'": "'Chỉ có thể đánh giá đơn hàng đã hoàn thành'",
  "'Order has already been reviewed'": "'Đơn hàng đã được đánh giá'",
  "'Invalid status'": "'Trạng thái không hợp lệ'",
  "'Order must be CONFIRMED to pickup'": "'Đơn hàng phải ở trạng thái ĐÃ XÁC NHẬN để lấy hàng'",
  "'Order must be WAITING_FOR_PICKUP to ship'": "'Đơn hàng phải ở trạng thái CHỜ LẤY HÀNG để giao'",
  "'Order must be IN_TRANSIT to deliver'": "'Đơn hàng phải ở trạng thái ĐANG GIAO để xác nhận giao hàng'",
  "'Invalid signature'": "'Chữ ký không hợp lệ'",
  "'Transaction not found'": "'Không tìm thấy giao dịch'",

  // Notification
  "'Notification marked as read'": "'Đã đánh dấu thông báo đã đọc'",
  "'All notifications marked as read'": "'Đã đánh dấu tất cả thông báo đã đọc'",

  // Message
  "'Conversation not found or you don\\'t have access'": "'Không tìm thấy cuộc hội thoại hoặc bạn không có quyền truy cập'",

  // Inspector
  "'Bicycle is not available for inspection'": "'Xe đạp không khả dụng để kiểm định'",
  "'Bicycle claimed successfully'": "'Nhận kiểm định xe đạp thành công'",
  "'You are not assigned to inspect this bicycle'": "'Bạn không được phân công kiểm định xe đạp này'",
  "'Inspection report submitted successfully'": "'Gửi báo cáo kiểm định thành công'",
  "'Report not found'": "'Không tìm thấy báo cáo'",

  // Device Token
  "'Failed to register FCM token'": "'Đăng ký FCM token thất bại'",
  "'No device tokens found for this user'": "'Không tìm thấy device token cho người dùng này'",
  "'Notification sent successfully'": "'Gửi thông báo thành công'",
  "'Failed to send notification'": "'Gửi thông báo thất bại'",
  "'Failed to remove FCM token'": "'Xoá FCM token thất bại'",

  // Conversation
  "'Invalid receiverId format'": "'Định dạng receiverId không hợp lệ'",
  "'You cannot create a conversation with yourself'": "'Bạn không thể tạo cuộc hội thoại với chính mình'",
  "'Conversation retrieved or created successfully'": "'Lấy hoặc tạo cuộc hội thoại thành công'",
  "'Conversations retrieved successfully'": "'Lấy danh sách cuộc hội thoại thành công'",

  // Brand
  "'Brand already exits'": "'Thương hiệu đã tồn tại'",
  "'Failed to create brand'": "'Tạo thương hiệu thất bại'",
  "'Failed to update brand'": "'Cập nhật thương hiệu thất bại'",
  "'Failed to delete brand'": "'Xoá thương hiệu thất bại'",

  // Category
  "'Failed to create category'": "'Tạo danh mục thất bại'",
  "'Failed to update category'": "'Cập nhật danh mục thất bại'",
  "'Failed to delete category'": "'Xoá danh mục thất bại'",
  "'Category already exists'": "'Danh mục đã tồn tại'",

  // Bicycle Model
  "'Model name already exists for this brand'": "'Tên mẫu xe đã tồn tại cho thương hiệu này'",
  "'Failed to create bicycle model'": "'Tạo mẫu xe thất bại'",
  "'Failed to update bicycle model'": "'Cập nhật mẫu xe thất bại'",
  "'Failed to delete bicycle model'": "'Xoá mẫu xe thất bại'",
  "'Model not found'": "'Không tìm thấy mẫu xe'",

  // Admin dashboard
  "'Internal server error'": "'Lỗi hệ thống'",

  // Misc
  "'Receiver not found'": "'Không tìm thấy người nhận'",
  "'Receiver is not found or not an admin'": "'Không tìm thấy người nhận hoặc không phải admin'",
  "'Only the buyer can report this order'": "'Chỉ người mua mới có thể báo cáo đơn hàng này'",
  "'This order has already been reported'": "'Đơn hàng này đã được báo cáo'",
  "'Can only report orders that are delivered or completed'": "'Chỉ có thể báo cáo đơn hàng đã giao hoặc hoàn thành'",
  "'Message sent successfully'": "'Gửi tin nhắn thành công'",
  "'Messages retrieved successfully'": "'Lấy tin nhắn thành công'",
  "'Conversation is locked'": "'Cuộc hội thoại đã bị khoá'",
  "'Order cannot be cancelled'": "'Đơn hàng không thể huỷ'",
  "'Only the seller can confirm or reject orders'": "'Chỉ người bán mới có thể xác nhận hoặc từ chối đơn hàng'",
  "'Invalid action, must be confirm or reject'": "'Hành động không hợp lệ, phải là xác nhận hoặc từ chối'",
  
  // Admin user controller
  "'User role updated successfully'": "'Cập nhật quyền người dùng thành công'",
  "'Role is required'": "'Quyền là bắt buộc'",
  "'Invalid role'": "'Quyền không hợp lệ'",
  "'Users retrieved successfully'": "'Lấy danh sách người dùng thành công'",
  "'User details retrieved successfully'": "'Lấy thông tin người dùng thành công'",
  "'User status updated successfully'": "'Cập nhật trạng thái người dùng thành công'",

  // Admin wallet
  "'Transfer reference is required for approval'": "'Mã tham chiếu chuyển khoản là bắt buộc khi duyệt'",
  "'Reason is required for rejection'": "'Lý do là bắt buộc khi từ chối'",
  "'Seller wallet not found'": "'Không tìm thấy ví người bán'",
};

// Directories to process
const dirs = [
  path.join(__dirname, 'controllers'),
  path.join(__dirname, 'controllers', 'admin'),
];

let totalChanges = 0;
let filesChanged = 0;

for (const dir of dirs) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    let changeCount = 0;
    
    for (const [eng, vi] of Object.entries(translations)) {
      const regex = new RegExp(eng.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = content.match(regex);
      if (matches) {
        content = content.replace(regex, vi);
        changeCount += matches.length;
      }
    }
    
    if (changeCount > 0) {
      fs.writeFileSync(filePath, content);
      console.log(`${path.relative(__dirname, filePath)}: ${changeCount} translations`);
      totalChanges += changeCount;
      filesChanged++;
    }
  }
}

console.log(`\nDone! ${totalChanges} translations across ${filesChanged} files`);
