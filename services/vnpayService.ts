import crypto from 'crypto';
import querystring from 'qs';


const VNP_TMN_CODE = process.env.VNP_TMN_CODE || '';
const VNP_HASH_SECRET = process.env.VNP_HASH_SECRET || '';
const VNP_URL = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
const VNP_RETURN_URL = process.env.VNP_RETURN_URL || 'http://localhost:5000/api/wallets/vnpay-return';

/**
 * Sort + encode object theo đúng chuẩn VNPay official sample
 * Keys & values đều được encodeURIComponent, spaces → +
 */
function sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys: string[] = [];

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys.push(encodeURIComponent(key));
        }
    }
    keys.sort();

    for (const key of keys) {
        sorted[key] = encodeURIComponent(obj[decodeURIComponent(key)]).replace(/%20/g, '+');
    }
    return sorted;
}


function formatVnpDate(date: Date): string {
    // VNPay yêu cầu format: yyyyMMddHHmmss
    // VD: 2026-02-27 14:30:00 → "20260227143000"
    const pad = (n: number) => n.toString().padStart(2, '0');
    return date.getFullYear().toString()
        + pad(date.getMonth() + 1)  // month 0-indexed nên +1
        + pad(date.getDate())
        + pad(date.getHours())
        + pad(date.getMinutes())
        + pad(date.getSeconds());
}



export interface CreatePaymentUrlParams {
    amount: number;       // Số tiền VND (VD: 100000)
    orderId: string;      // Mã giao dịch CỦA MÌNH (VD: "DEP-20260227...")
    orderInfo: string;    // Nội dung hiển thị trên VNPay (VD: "Nap tien vi")
    ipAddr: string;       
    locale?: 'vn' | 'en'; // Ngôn ngữ hiển thị trên VNPay
    bankCode?: string;    
}



export function createPaymentUrl(params: CreatePaymentUrlParams): string {
    const { amount, orderId, orderInfo, ipAddr, locale = 'vn', bankCode } = params;
    const now = new Date();
    let vnpParams: Record<string, string> = {
        vnp_Version: '2.1.0',          // Phiên bản API, luôn là '2.1.0'
        vnp_Command: 'pay',            // Lệnh thanh toán, luôn là 'pay'
        vnp_TmnCode: VNP_TMN_CODE,     // 'O9ZPZ43F' - VNPay biết website nào gọi
        vnp_Locale: locale,            // 'vn' hoặc 'en'
        vnp_CurrCode: 'VND',           // Luôn VND
        vnp_TxnRef: orderId,           // ⭐ Mã giao dịch CỦA MÌNH - dùng để map lại khi callback
        vnp_OrderInfo: orderInfo,       // Nội dung giao dịch (hiển thị cho user)
        vnp_OrderType: 'other',         // Loại hàng: 'other' cho topup ví
        vnp_Amount: (amount * 100).toString(),  // ⚠️ NHÂN 100! VNPay quy định
        vnp_ReturnUrl: VNP_RETURN_URL,  // URL redirect về sau thanh toán
        vnp_IpAddr: ipAddr,            // IP user
        vnp_CreateDate: formatVnpDate(now),  // Thời gian tạo
    };
    if (bankCode) {
        vnpParams['vnp_BankCode'] = bankCode;  // Nếu user đã chọn ngân hàng
    }

    // Link hết hạn sau 15 phút
    const expireDate = new Date(now.getTime() + 15 * 60 * 1000);
    vnpParams['vnp_ExpireDate'] = formatVnpDate(expireDate);

    // Sort alphabet (BẮT BUỘC)
    vnpParams = sortObject(vnpParams);

    // Ký: stringify KHÔNG encode (VNPay quy định)
    const signData = querystring.stringify(vnpParams, { encode: false });

    // Ký bằng HMAC-SHA512 với secret key
    const hmac = crypto.createHmac('sha512', VNP_HASH_SECRET);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Gắn chữ ký vào params
    vnpParams['vnp_SecureHash'] = signed; 

    // URL cuối: KHÔNG encode (VNPay yêu cầu — nên orderInfo không được có ký tự đặc biệt)
    return `${VNP_URL}?${querystring.stringify(vnpParams, { encode: false })}`;
}


export function verifyReturnUrl(vnpParams: Record<string, string>): boolean {
    // Lấy chữ ký VNPay gửi về
    const secureHash = vnpParams['vnp_SecureHash'];
    if (!secureHash) return false;

    // Bỏ hash ra khỏi params (vì lúc ký ban đầu không có hash)
    const params = { ...vnpParams };
    delete params['vnp_SecureHash'];
    delete params['vnp_SecureHashType'];

    // Ký lại y hệt quy trình tạo URL
    const sorted = sortObject(params);
    const signData = querystring.stringify(sorted, { encode: false });
    const hmac = crypto.createHmac('sha512', VNP_HASH_SECRET);
    const checkSum = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // So sánh: chữ ký mình tạo === chữ ký VNPay gửi?
    return secureHash === checkSum;
   
}


export function getResponseMessage(responseCode: string): string {
    const messages: Record<string, string> = {
        '00': 'Transaction successful',
        '07': 'Payment deducted but transaction is suspicious (potential fraud)',
        '09': 'Card/Account has not registered for Internet Banking',
        '10': 'Incorrect card information verified more than 3 times',
        '11': 'Payment timeout expired',
        '12': 'Card/Account is locked',
        '13': 'Incorrect OTP password',
        '24': 'Transaction cancelled by customer',
        '51': 'Insufficient account balance',
        '65': 'Account has exceeded daily transaction limit',
        '75': 'Payment bank is under maintenance',
        '79': 'Incorrect payment password exceeded allowed attempts',
        '99': 'Unknown error',
    };
    return messages[responseCode] || `Unknown error (code: ${responseCode})`;
}