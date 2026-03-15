import { z } from 'zod';

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
    newPassword: z.string()
        .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
        .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất một chữ hoa')
        .regex(/[a-z]/, 'Mật khẩu phải chứa ít nhất một chữ thường')
        .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất một chữ số')
        .regex(/[^A-Za-z0-9]/, 'Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)'),
    confirmPassword: z.string().min(1, 'Vui lòng xác nhận mật khẩu mới')
}).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Mật khẩu xác nhận không khớp',
    path: ['confirmPassword'],
}).refine(data => data.currentPassword !== data.newPassword, {
    message: 'Mật khẩu mới phải khác mật khẩu hiện tại',
    path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
