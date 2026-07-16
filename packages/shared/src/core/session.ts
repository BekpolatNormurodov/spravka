import { SignJWT, jwtVerify } from 'jose';
import { Role } from './enums';

const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me-min-32-chars-long!!');

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
