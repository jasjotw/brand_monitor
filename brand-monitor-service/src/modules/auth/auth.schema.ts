import { z } from 'zod';

export const registerSchema = z.object({
    name: z.string().min(1, 'Name is required').max(255),
    email: z.string().email('Invalid email address'),
    pwd: z.string().min(8, 'Password must be at least 8 characters'),
    phone: z.string().min(1, 'Phone number is required').max(20),
    brandingMode: z.enum(['whitelabel', 'self-brand']).optional(),
});

export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    pwd: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
