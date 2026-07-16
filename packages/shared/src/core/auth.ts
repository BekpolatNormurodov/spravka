import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { Role } from './enums';

const secret = () =>
  new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-secret-change-me-min-32-chars-long!!');

export const COOKIE_NAME = 'spravka_session';

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
    return {
      sub: String(payload.sub),
      login: String(payload.login),
      role: payload.role as Role,
      fullName: String(payload.fullName),
    };
  } catch {
    return null;
  }
}

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
