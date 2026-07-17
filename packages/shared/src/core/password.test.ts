import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, seedPassword, DEMO_PASSWORD } from './password';

describe('password hashing', () => {
  it('hashes and verifies', async () => {
    const hash = await hashPassword('secret123');
    expect(hash).not.toBe('secret123');
    expect(await verifyPassword('secret123', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

/**
 * What these guard against leaves no trace: seeding succeeds, the app boots, logins work — and
 * `rahbar`, the account that signs maʼlumotnoma, has a password anyone can read in this file.
 * The deploy runbook runs db:seed on the server, so it is the ordinary path that has to refuse.
 */
describe('SEED_PASSWORD in production', () => {
  const withEnv = (env: Record<string, string | undefined>, fn: () => unknown) => {
    const prev = { ...process.env };
    Object.assign(process.env, env);
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    try {
      return fn();
    } finally {
      process.env = prev;
    }
  };

  it('refuses to seed production with no SEED_PASSWORD', () => {
    withEnv({ NODE_ENV: 'production', SEED_PASSWORD: undefined }, () => {
      expect(() => seedPassword()).toThrow(/refusing to seed production/);
    });
  });

  it('refuses the published demo password in production', () => {
    withEnv({ NODE_ENV: 'production', SEED_PASSWORD: DEMO_PASSWORD }, () => {
      expect(() => seedPassword()).toThrow(/published demo password/);
    });
  });

  it('refuses a short password in production', () => {
    withEnv({ NODE_ENV: 'production', SEED_PASSWORD: 'kalta' }, () => {
      expect(() => seedPassword()).toThrow(/shorter than 8/);
    });
  });

  it('accepts a real password in production', () => {
    withEnv({ NODE_ENV: 'production', SEED_PASSWORD: 'a-real-one-from-openssl' }, () => {
      expect(seedPassword()).toBe('a-real-one-from-openssl');
    });
  });

  it('still uses the demo password in dev, so nothing changes locally', () => {
    withEnv({ NODE_ENV: 'development', SEED_PASSWORD: undefined }, () => {
      expect(seedPassword()).toBe(DEMO_PASSWORD);
    });
  });
});
