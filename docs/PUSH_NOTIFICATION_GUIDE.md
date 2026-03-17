# Push Notification Guide (Mobile App Integration)

## API Endpoints

Tất cả endpoints yêu cầu `Authorization: Bearer <firebase_id_token>`.

### 1. Đăng ký FCM Token

```
POST /api/device-tokens/register
```

**Body:**
```json
{
  "fcmToken": "string (required)",
  "deviceType": "ios | android | web (required)",
  "deviceName": "string (optional)"
}
```

**Khi nào gọi:**
- Sau khi user **đăng nhập** thành công
- Khi FCM token được **refresh** (Firebase tự động refresh token định kỳ)

---

### 2. Gửi Push Notification

```
POST /api/device-tokens/send
```

**Body:**
```json
{
  "userId": "string (required) - ID người nhận",
  "title": "string (required, max 200)",
  "body": "string (required, max 1000)",
  "data": { "key": "value" }
}
```

> **Note:** API này chủ yếu được backend tự gọi nội bộ. Mobile app thường không cần gọi trực tiếp.

---

### 3. Xoá FCM Token

```
DELETE /api/device-tokens
```

**Body:**
```json
{
  "fcmToken": "string (required)"
}
```

**Khi nào gọi:**
- Khi user **đăng xuất** (logout)
- Khi user **tắt notification** trong settings

---

## Notification Types & Deep Linking

Khi nhận push notification, sử dụng field `data.type` để điều hướng người dùng:

| `data.type` | `data` fields | Điều hướng đến |
|-------------|--------------|----------------|
| `NEW_ORDER` | `orderId` | Trang chi tiết đơn hàng |
| `ORDER_CONFIRMED` | `orderId` | Trang chi tiết đơn hàng |
| `ORDER_REJECTED` | `orderId` | Trang chi tiết đơn hàng |
| `ORDER_CANCELLED` | `orderId` | Trang chi tiết đơn hàng |
| `ORDER_DELIVERED` | `orderId` | Trang chi tiết đơn hàng |
| `WAITING_REMAINING_PAYMENT` | `orderId` | Trang thanh toán đơn hàng |
| `PAYMENT_RECEIVED` | `orderId` | Trang chi tiết đơn hàng |
| `NEW_MESSAGE` | `conversationId` | Trang chat |
| `INSPECTION_COMPLETED` | `bicycleId`, `reportId` | Trang chi tiết xe |

---

## Ví dụ tích hợp (React Native)

```javascript
import messaging from '@react-native-firebase/messaging';

// 1. Lấy FCM token và đăng ký
async function registerFCMToken(authToken) {
  const fcmToken = await messaging().getToken();
  await fetch('https://your-api.com/api/device-tokens/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({
      fcmToken,
      deviceType: Platform.OS, // 'ios' or 'android'
      deviceName: DeviceInfo.getModel()
    })
  });
}

// 2. Xoá token khi logout
async function logout(authToken, fcmToken) {
  await fetch('https://your-api.com/api/device-tokens', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    },
    body: JSON.stringify({ fcmToken })
  });
}

// 3. Lắng nghe token refresh
messaging().onTokenRefresh(async (newToken) => {
  await registerFCMToken(authToken); // Re-register với token mới
});

// 4. Xử lý notification khi app đang mở
messaging().onMessage(async (remoteMessage) => {
  // Hiển thị local notification hoặc in-app alert
});

// 5. Xử lý notification khi tap (app background/quit)
messaging().onNotificationOpenedApp((remoteMessage) => {
  const { type, orderId, conversationId } = remoteMessage.data;
  // Navigate đến màn hình tương ứng
});
```
