import nodemailer from 'nodemailer';

//Interface
interface EmailOptions {
    to: string,
    subject: string,
    html: string
}

//Send mail function
export const sendMail = async (
    options: EmailOptions
): Promise<boolean> => {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const info = await transporter.sendMail({
            from: '"Xedaptot Team" <' + process.env.EMAIL_USER + '>',
            to: options.to,
            subject: options.subject,
            html: options.html
        });

        console.log('Email sent successfully:', info.messageId);
        return true;
    } catch (error) {
        console.error('Error sending email:', error);
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
    const verifyUrl = `${process.env.API_URL}/auth/verify-email?token=${verificationToken}`;

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Xác thực Email của bạn</h2>
            <p>Xin chào <strong>${fullName || 'bạn'}</strong>,</p>
            <p>Cảm ơn bạn đã đăng ký tài khoản tại Xedaptot. Vui lòng click vào nút bên dưới để xác thực email:</p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="${verifyUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold;">
                    Xác thực Email
                </a>
            </div>
            <p style="color: #666; font-size: 14px;">
                Hoặc copy link sau vào trình duyệt:<br>
                <a href="${verifyUrl}">${verifyUrl}</a>
            </p>
            <p style="color: #999; font-size: 12px;">
                Link này sẽ hết hạn sau 24 giờ.
            </p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px;">
                Nếu bạn không đăng ký tài khoản, vui lòng bỏ qua email này.
            </p>
        </div>
    `;

    return sendMail({
        to: email,
        subject: '[Xedaptot] Verify your email',
        html
    });
};
