import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { users } from '../../db/schema';
import { generateToken, JwtPayload } from '../../utils/jwt';
import { RegisterInput, LoginInput } from './auth.schema';
import { ApiError, ErrorCode, NotFoundError } from '../../utils/errors';
import { logMethodEntry } from '../../utils/logger';
import { initializeCreditsForUser } from '../../services/credit.service';
import { ensureUserSubscription, getUserActivePlanCode, PlanCode } from '../../services/plan.service';

const SALT_ROUNDS = 12;

export async function registerUser(data: RegisterInput): Promise<void> {
    logMethodEntry('authService.registerUser', { email: data.email });
    const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1);

    if (existing.length > 0) {
        throw new ApiError('Email already registered', 409, ErrorCode.ALREADY_EXISTS);
    }

    const hashedPwd = await bcrypt.hash(data.pwd, SALT_ROUNDS);

    const brandingMode = data.brandingMode === 'whitelabel' ? 'white-label' : 'self';
    const defaultPlan: PlanCode = brandingMode === 'white-label' ? 'business' : 'basic';

    const inserted = await db.insert(users).values({
        name: data.name,
        email: data.email,
        pwd: hashedPwd,
        phone: data.phone,
        config: {
            branding_mode: brandingMode,
            byob: 'no',
            notification: true,
        },
    }).returning({ id: users.id });

    const userId = String(inserted[0]?.id ?? '');
    if (userId) {
        await initializeCreditsForUser(userId);
        await ensureUserSubscription(userId, defaultPlan, '[Plan Register]');
    }
}

export async function loginUser(data: LoginInput): Promise<string> {
    logMethodEntry('authService.loginUser', { email: data.email });
    const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, data.email))
        .limit(1);

    if (!user) {
        throw new ApiError('Invalid email or password', 401, ErrorCode.UNAUTHORIZED);
    }

    const isMatch = await bcrypt.compare(data.pwd, user.pwd);
    if (!isMatch) {
        throw new ApiError('Invalid email or password', 401, ErrorCode.UNAUTHORIZED);
    }

    await ensureUserSubscription(String(user.id), 'basic', '[Plan Login]');

    return generateToken(user.id, user.email);
}

export function refreshTokenFromPayload(payload: JwtPayload): string {
    logMethodEntry('authService.refreshTokenFromPayload', { userId: payload.userId });
    return generateToken(payload.userId, payload.email);
}

export async function getMe(
    userId: number
): Promise<Omit<typeof users.$inferSelect, 'pwd'> & { plan: string | null }> {
    logMethodEntry('authService.getMe', { userId });
    const [user] = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            phone: users.phone,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            config: users.config,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user) {
        throw new NotFoundError('User');
    }

    const plan = await getUserActivePlanCode(String(userId));

    return { ...user, plan };
}
