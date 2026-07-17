import { describe, it, expect } from 'vitest';
import { certPublicUrl } from './qr';

/**
 * This string is encoded into a QR, printed onto a maʼlumotnoma and frozen into the stored PDF.
 * Getting it wrong is not a bug you fix — an issued document cannot be re-printed, so every
 * document from that build carries a QR that resolves to nothing, forever. These tests exist
 * because the failure has no symptom until someone scans paper.
 */
const withEnv = <T>(env: Record<string, string | undefined>, fn: () => T): T => {
  const prev = { ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    process.env = prev;
  }
};

describe('certPublicUrl', () => {
  it('builds the public path from the configured base', () => {
    withEnv({ NEXT_PUBLIC_PUBLIC_URL: 'https://qrsystem.uz' }, () => {
      expect(certPublicUrl('abc123')).toBe('https://qrsystem.uz/m/abc123');
    });
  });

  it('does not double the slash when the base has a trailing one', () => {
    withEnv({ NEXT_PUBLIC_PUBLIC_URL: 'https://qrsystem.uz/' }, () => {
      expect(certPublicUrl('abc123')).toBe('https://qrsystem.uz/m/abc123');
    });
  });

  it('refuses to build a localhost QR in production', () => {
    withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_PUBLIC_URL: undefined }, () => {
      expect(() => certPublicUrl('abc123')).toThrow(/NEXT_PUBLIC_PUBLIC_URL is not set/);
    });
  });

  it('falls back to localhost in development, where paper is not involved', () => {
    withEnv({ NODE_ENV: 'development', NEXT_PUBLIC_PUBLIC_URL: undefined }, () => {
      expect(certPublicUrl('abc123')).toBe('http://localhost:5100/m/abc123');
    });
  });

  it('honours an explicit base even in production', () => {
    // The caller passing one has said what they mean; the guard is for the silent path.
    withEnv({ NODE_ENV: 'production', NEXT_PUBLIC_PUBLIC_URL: undefined }, () => {
      expect(certPublicUrl('abc123', 'https://qrsystem.uz')).toBe('https://qrsystem.uz/m/abc123');
    });
  });
});
