import { createHmac } from 'crypto';
import { env } from '../config/env';

export interface JwtPayload {
    userId: number;
    email: string;
    exp: number;
}

const HEADER = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' })
).toString('base64url');

function base64url(data: string): string {
    return Buffer.from(data).toString('base64url');
}

function getJwtSecret(): string {
    if (!env.JWT_SECRET) {
        throw new Error('[auth] Missing JWT_SECRET in environment');
    }
    return env.JWT_SECRET;
}

function sign(input: string): string {
    return createHmac('sha256', getJwtSecret()).update(input).digest('base64url');
}

export function generateToken(userId: number, email: string): string {
    const payload: JwtPayload = {
        userId,
        email,
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    };

    const encodedPayload = base64url(JSON.stringify(payload));
    const signingInput = `${HEADER}.${encodedPayload}`;
    const signature = sign(signingInput);

    return `${signingInput}.${signature}`;
}

export function verifyToken(token: string): JwtPayload {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token structure');
    }

    const [headerB64, payloadB64, signature] = parts as [string, string, string];

    const expectedSig = sign(`${headerB64}.${payloadB64}`);
    if (signature !== expectedSig) {
        throw new Error('Invalid token signature');
    }

    let payload: JwtPayload;
    try {
        payload = JSON.parse(
            Buffer.from(payloadB64, 'base64url').toString('utf8')
        ) as JwtPayload;
    } catch {
        throw new Error('Invalid token payload');
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
        throw new Error('Token has expired');
    }

    return payload;
}
