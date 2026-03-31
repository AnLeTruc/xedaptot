import { Resend } from 'resend';

//Interface
interface EmailOptions {
    to: string,
    subject: string,
    html: string
}

interface WithdrawEmailPayload {
    requestId: string;
    amount: number;
    bankInfo: {
        bankName: string;
        accountNumber: string;
        accountName: string;
    };
    requestedAt: Date;
    processedAt?: Date;
    reason?: string;
    transferReference?: string;
}

const formatVndCurrency = (amount: number): string => `${amount.toLocaleString('vi-VN')}đ`;

const formatDateTime = (value?: Date): string => {
    if (!value) return 'N/A';
    return new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
};

//Send mail function using Resend API
export const sendMail = async (
    options: EmailOptions
): Promise<boolean> => {
    try {
        const resendApiKey = process.env.RESEND_API_KEY;
        const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER;

        if (!resendApiKey) {
            throw new Error('Resend chưa được cấu hình. Cần thiết lập RESEND_API_KEY.');
        }

        if (!emailFrom) {
            throw new Error('Thiếu EMAIL_FROM. Cần thiết lập EMAIL_FROM thành email đã xác thực.');
        }

        const resend = new Resend(resendApiKey);

        await resend.emails.send({
            from: `Đội ngũ Xedaptot <${emailFrom}>`,
            to: options.to,
            subject: options.subject,
            html: options.html
        });

        console.log('Email sent via Resend.');
        return true;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Email error:', errorMessage);
        return false;
    }
}

//Send verification email
export const sendVerificationEmail = async (
    email: string,
    verificationToken: string,
    fullName: string
): Promise<boolean> => {
    //Url to verify
    const appBaseUrl = (process.env.APP_URL || process.env.FRONTEND_URL || process.env.API_URL || '').replace(/\/$/, '');
    const verifyUrl = `${appBaseUrl}/auth/verify-email?token=${verificationToken}`;
    const supportEmail = process.env.EMAIL_SUPPORT || process.env.EMAIL_USER || 'support@xedaptot.com';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
            <h2 style="color: #2563eb; margin: 0 0 8px;">Xác thực email Xedaptot</h2>
            <p style="margin: 0 0 12px;">Xin chào <strong>${fullName || 'bạn'}</strong>,</p>
            <p style="margin: 0 0 16px;">Cảm ơn bạn đã đăng ký Xedaptot. Vui lòng xác thực email để kích hoạt tài khoản.</p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="${verifyUrl}"
                   style="background-color: #2563eb; color: #ffffff; padding: 12px 28px;
                          text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                    Xác thực email
                </a>
            </div>
            <p style="color: #374151; font-size: 14px; margin: 0 0 8px;">
                Nếu nút không hoạt động, vui lòng mở đường dẫn sau trong trình duyệt:
            </p>
            <p style="font-size: 14px; margin: 0 0 12px;">
                <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 12px;">Đường dẫn này sẽ hết hạn sau 24 giờ.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">Nếu bạn không yêu cầu thao tác này, vui lòng bỏ qua email hoặc liên hệ ${supportEmail}.</p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 12px;">© Xedaptot</p>
    </div>
    `;

    return sendMail({
        to: email,
        subject: '[Xedaptot] Xác thực email của bạn',
        html
    });
};

// Send inspector welcome email with credentials
export const sendInspectorWelcomeEmail = async (
    email: string,
    tempPassword: string,
    fullName: string
): Promise<boolean> => {
    const appBaseUrl = (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const loginUrl = `${appBaseUrl}/login`;
    const supportEmail = process.env.EMAIL_SUPPORT || 'support@xedaptot.com';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
            <h2 style="color: #10b981; margin: 0 0 8px;">Chào mừng bạn gia nhập đội ngũ Kiểm định viên!</h2>
            <p style="margin: 0 0 12px;">Xin chào <strong>${fullName || 'Kiểm định viên'}</strong>,</p>
            <p style="margin: 0 0 16px;">Tài khoản Kiểm định viên của bạn đã được tạo thành công trên nền tảng Xedaptot.</p>
            
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0 0 8px;"><strong>Thông tin đăng nhập:</strong></p>
                <p style="margin: 0 0 4px;">Email: <strong>${email}</strong></p>
                <p style="margin: 0;">Mật khẩu tạm thời: <strong>${tempPassword}</strong></p>
            </div>
            
            <p style="color: #dc2626; font-size: 14px; margin: 0 0 16px;">
                Vui lòng đổi mật khẩu ngay sau lần đăng nhập đầu tiên!
            </p>
            
            <div style="text-align: center; margin: 24px 0;">
                <a href="${loginUrl}"
                   style="background-color: #10b981; color: #ffffff; padding: 12px 28px;
                          text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                    Đăng nhập ngay
                </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Nếu bạn không yêu cầu tạo tài khoản này, vui lòng liên hệ ${supportEmail}.
            </p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 12px;">© Xedaptot</p>
    </div>
    `;

    return sendMail({
        to: email,
        subject: '[Xedaptot] Tài khoản Kiểm định viên đã sẵn sàng!',
        html
    });
};

// Send password changed notification email
export const sendPasswordChangedEmail = async (
    email: string,
    fullName: string
): Promise<boolean> => {
    const supportEmail = process.env.EMAIL_SUPPORT || 'support@xedaptot.com';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
            <h2 style="color: #2563eb; margin: 0 0 8px;">Mật khẩu đã được thay đổi</h2>
            <p style="margin: 0 0 12px;">Xin chào <strong>${fullName || 'bạn'}</strong>,</p>
            <p style="margin: 0 0 16px;">
                Mật khẩu tài khoản Xedaptot của bạn đã được thay đổi thành công vào lúc
                <strong>${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</strong>.
            </p>
            <p style="margin: 0 0 16px;">
                Nếu bạn không thực hiện thay đổi này, vui lòng đặt lại mật khẩu ngay hoặc liên hệ
                <a href="mailto:${supportEmail}" style="color: #2563eb;">${supportEmail}</a>.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
                Đây là thông báo tự động. Vui lòng không trả lời email này.
            </p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 12px;">© Xedaptot</p>
    </div>
    `;

    return sendMail({
        to: email,
        subject: '[Xedaptot] Mật khẩu của bạn đã được thay đổi',
        html
    });
};

export const sendWithdrawApprovedEmail = async (
    email: string,
    fullName: string,
    payload: WithdrawEmailPayload
): Promise<boolean> => {
    const supportEmail = process.env.EMAIL_SUPPORT || process.env.EMAIL_USER || 'support@xedaptot.com';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
            <h2 style="color: #16a34a; margin: 0 0 8px;">Yêu cầu rút tiền đã được duyệt</h2>
            <p style="margin: 0 0 12px;">Xin chào <strong>${fullName || 'bạn'}</strong>,</p>
            <p style="margin: 0 0 16px;">Yêu cầu rút tiền của bạn đã được duyệt và xử lý bởi đội ngũ quản trị Xedaptot.</p>
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0 0 8px;"><strong>Mã yêu cầu:</strong> ${payload.requestId}</p>
                <p style="margin: 0 0 8px;"><strong>Số tiền:</strong> ${formatVndCurrency(payload.amount)}</p>
                <p style="margin: 0 0 8px;"><strong>Ngân hàng:</strong> ${payload.bankInfo.bankName}</p>
                <p style="margin: 0 0 8px;"><strong>Số tài khoản:</strong> ${payload.bankInfo.accountNumber}</p>
                <p style="margin: 0 0 8px;"><strong>Tên tài khoản:</strong> ${payload.bankInfo.accountName}</p>
                <p style="margin: 0 0 8px;"><strong>Ngày yêu cầu:</strong> ${formatDateTime(payload.requestedAt)}</p>
                <p style="margin: 0 0 8px;"><strong>Ngày xử lý:</strong> ${formatDateTime(payload.processedAt)}</p>
                <p style="margin: 0;"><strong>Mã tham chiếu:</strong> ${payload.transferReference || 'N/A'}</p>
            </div>
            <p style="margin: 0 0 16px;">Nếu bạn có thắc mắc, vui lòng liên hệ <a href="mailto:${supportEmail}" style="color: #2563eb;">${supportEmail}</a>.</p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 12px;">© Xedaptot</p>
    </div>
    `;

    return sendMail({
        to: email,
        subject: '[Xedaptot] Yêu cầu rút tiền đã được duyệt',
        html
    });
};

export const sendWithdrawRejectedEmail = async (
    email: string,
    fullName: string,
    payload: WithdrawEmailPayload
): Promise<boolean> => {
    const supportEmail = process.env.EMAIL_SUPPORT || process.env.EMAIL_USER || 'support@xedaptot.com';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
            <h2 style="color: #dc2626; margin: 0 0 8px;">Yêu cầu rút tiền bị từ chối</h2>
            <p style="margin: 0 0 12px;">Xin chào <strong>${fullName || 'bạn'}</strong>,</p>
            <p style="margin: 0 0 16px;">Yêu cầu rút tiền của bạn đã bị từ chối bởi đội ngũ quản trị Xedaptot.</p>
            <div style="background-color: #f9fafb; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="margin: 0 0 8px;"><strong>Mã yêu cầu:</strong> ${payload.requestId}</p>
                <p style="margin: 0 0 8px;"><strong>Số tiền:</strong> ${formatVndCurrency(payload.amount)}</p>
                <p style="margin: 0 0 8px;"><strong>Ngân hàng:</strong> ${payload.bankInfo.bankName}</p>
                <p style="margin: 0 0 8px;"><strong>Số tài khoản:</strong> ${payload.bankInfo.accountNumber}</p>
                <p style="margin: 0 0 8px;"><strong>Tên tài khoản:</strong> ${payload.bankInfo.accountName}</p>
                <p style="margin: 0 0 8px;"><strong>Ngày yêu cầu:</strong> ${formatDateTime(payload.requestedAt)}</p>
                <p style="margin: 0 0 8px;"><strong>Ngày xử lý:</strong> ${formatDateTime(payload.processedAt)}</p>
                <p style="margin: 0;"><strong>Lý do:</strong> ${payload.reason || 'Không có lý do'}</p>
            </div>
            <p style="margin: 0 0 16px;">Số tiền đã đóng băng đã được hoàn lại vào ví của bạn. Nếu cần hỗ trợ, vui lòng liên hệ <a href="mailto:${supportEmail}" style="color: #2563eb;">${supportEmail}</a>.</p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 12px;">© Xedaptot</p>
    </div>
    `;

    return sendMail({
        to: email,
        subject: '[Xedaptot] Yêu cầu rút tiền bị từ chối',
        html
    });
};
