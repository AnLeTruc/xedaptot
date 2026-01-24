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
    const appBaseUrl = (process.env.APP_URL || process.env.FRONTEND_URL || process.env.API_URL || 'http://localhost:5000').replace(/\/$/, '');
    const verifyUrl = `${appBaseUrl}/auth/verify-email?token=${verificationToken}`;
    const supportEmail = process.env.EMAIL_SUPPORT || process.env.EMAIL_USER || 'support@xedaptot.com';

    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #111827;">
        <div style="padding: 20px 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
            <h2 style="color: #2563eb; margin: 0 0 8px;">Verify your Xedaptot email</h2>
            <p style="margin: 0 0 12px;">Hi <strong>${fullName || 'there'}</strong>,</p>
            <p style="margin: 0 0 16px;">Thanks for signing up for Xedaptot. Please verify your email to activate your account.</p>
            <div style="text-align: center; margin: 24px 0;">
                <a href="${verifyUrl}"
                   style="background-color: #2563eb; color: #ffffff; padding: 12px 28px;
                          text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                    Verify email
                </a>
            </div>
            <p style="color: #374151; font-size: 14px; margin: 0 0 8px;">
                If the button does not work, open this link in your browser:
            </p>
            <p style="font-size: 14px; margin: 0 0 12px;">
                <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin: 0 0 12px;">This link expires in 24 hours.</p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">If you did not request this, please ignore this email or contact ${supportEmail}.</p>
        </div>
        <p style="color: #9ca3af; font-size: 11px; text-align: center; margin-top: 12px;">© Xedaptot</p>
    </div>
    `;

    return sendMail({
        to: email,
        subject: '[Xedaptot] Verify your email',
        html
    });
};
