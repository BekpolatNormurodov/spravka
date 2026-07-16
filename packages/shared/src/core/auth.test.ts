import { describe, it, expect } from 'vitest';
import { Role } from './enums';
import { createSession, verifySession, hashPassword, verifyPassword } from './auth';

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
});

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
