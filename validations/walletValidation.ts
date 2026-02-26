import { z } from 'zod';


export const depositSchema = z.object({
    amount: z.number()
        .min(10000, 'Minimum deposit amount is 10,000đ')
        .max(500000000, 'Maximum deposit amount is 500,000,000đ'),
});


export const withdrawSchema = z.object({
    amount: z.number()
        .min(1000, 'Minimum withdraw amount is 1,000đ')
        .max(500000000, 'Maximum withdraw amount is 500,000,000đ'),
    bankInfo: z.object({
        bankName: z.string().min(1, 'Bank name is required').max(100),
        accountNumber: z.string().min(1, 'Account number is required').max(30),
        accountName: z.string().min(1, 'Account holder name is required').max(100),
    })
});
