import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { registerSchema, loginSchema } from './auth.schema';
import * as authService from './auth.service';
import { ValidationError, AuthenticationError } from '../../utils/errors';
import { logMethodEntry } from '../../utils/logger';

export async function register(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        logMethodEntry('auth.register');
        const data = registerSchema.parse(req.body);
        await authService.registerUser(data);
        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        if (err instanceof ZodError) {
            next(new ValidationError(err.errors[0]?.message ?? 'Validation error'));
            return;
        }
        next(err);
    }
}

export async function login(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        logMethodEntry('auth.login');
        const data = loginSchema.parse(req.body);
        const token = await authService.loginUser(data);
        res.status(200).json({ token });
    } catch (err) {
        if (err instanceof ZodError) {
            next(new ValidationError(err.errors[0]?.message ?? 'Validation error'));
            return;
        }
        next(err);
    }
}

export async function getMe(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        logMethodEntry('auth.getMe');
        const { userId } = req.user!;
    const user = await authService.getMe(userId);
    res.status(200).json({ user });
} catch (err) {
    next(err);
}
}

export async function refresh(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        logMethodEntry('auth.refresh');
        const payload = req.user;
        if (!payload) {
            throw new AuthenticationError('Authorization required');
        }
        const token = authService.refreshTokenFromPayload(payload);
        res.json({ token });
    } catch (err) {
        next(err);
    }
}
