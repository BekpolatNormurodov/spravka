import { describe, it, expect } from 'vitest';
import { SignJWT } from 'jose';
import { Role } from './enums';
import { createSession, verifySession } from './session';

const payload = { sub: 'u1', login: 'yurist', role: Role.YURIST, fullName: 'Test Yurist' };

describe('session', () => {
  it('round-trips a signed session', async () => {
    const token = await createSession(payload);
    const back = await verifySession(token);
    expect(back?.login).toBe('yurist');
    expect(back?.role).toBe(Role.YURIST);
  });

  it('returns null for a missing or bad token', async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession('not.a.jwt')).toBeNull();
  });

  it('returns null when the role claim is not a valid Role', async () => {
    const secret = new TextEncoder().encode('dev-secret-change-me-min-32-chars-long!!');
    const token = await new SignJWT({ login: 'x', role: 'HACKER', fullName: 'X' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u9')
      .sign(secret);
    expect(await verifySession(token)).toBeNull();
  });
});
