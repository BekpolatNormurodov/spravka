import { SignJWT, jwtVerify } from 'jose';
import { Role } from './enums';

/** Convenience for `npm run dev`. Published in the repo, therefore worthless as a secret. */
const DEV_FALLBACK = 'dev-secret-change-me-min-32-chars-long!!';

/**
 * Values that are in the repo for anyone to read, so a session signed with one is forgeable by
 * anyone who has seen it. `.env.example` ships the second: copy it, forget to edit it, and the
 * app works perfectly while every session is public.
 */
const KNOWN = new Set([DEV_FALLBACK, 'change-me-to-a-long-random-string-min-32-chars']);

/**
 * The key every session is signed with.
 *
 * In production a missing or published secret is refused outright. It used to fall back to the
 * dev value silently: the app booted, logins worked, nothing looked wrong — and anyone who had
 * read this file could mint a session for any user, rahbar included, and sign maʼlumotnomas with
 * it. A signing system whose sessions are forgeable is not a signing system, and the failure had
 * no symptom to notice.
 *
 * Throwing here surfaces at the first login rather than at boot, which is not ideal but is loud,
 * immediate and impossible to miss — unlike the alternative.
 */
const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!s) throw new Error('AUTH_SECRET is not set — refusing to sign sessions in production');
    if (KNOWN.has(s)) throw new Error('AUTH_SECRET is the published example value — set a real one');
    // HS256 keys shorter than the 256-bit hash weaken it, and jose will not say so.
    if (s.length < 32) throw new Error('AUTH_SECRET is shorter than 32 characters');
  }
  return new TextEncoder().encode(s || DEV_FALLBACK);
};

export const COOKIE_NAME = 'spravka_session';

const VALID_ROLES: readonly Role[] = [Role.YURIST, Role.ADMIN, Role.RAHBAR];

export interface SessionPayload {
  sub: string;
  login: string;
  role: Role;
  fullName: string;
}

export async function createSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ login: p.login, role: p.role, fullName: p.fullName })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.sub)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const role = payload.role as Role;
    if (!VALID_ROLES.includes(role)) return null;
    return {
      sub: String(payload.sub),
      login: String(payload.login),
      role,
      fullName: String(payload.fullName),
    };
  } catch {
    return null;
  }
}
