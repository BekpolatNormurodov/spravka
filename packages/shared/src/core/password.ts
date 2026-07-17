// Node-only (bcryptjs). Imported via the `@spravka/shared/password` subpath so it never enters an
// edge-runtime bundle (e.g. Next.js middleware). Edge-safe session code lives in ./session.
import bcrypt from 'bcryptjs';

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

/** The seed's demo password. Published in the repository, so it is a dev-only value. */
export const DEMO_PASSWORD = 'parol123';

/**
 * The password `prisma/seed.ts` gives the demo accounts.
 *
 * The demo value is written in the repository, and the repository is public. Seeding production
 * with it hands over `rahbar` — the account that signs maʼlumotnoma — to anyone who can read the
 * source. Nothing downstream catches that: E-IMZO is asked for a signature only after the document
 * is already approved in the app, so a stolen login yields a genuinely signed, genuinely valid
 * document. And the deploy runbook runs `db:seed` on the server, so this is the ordinary path.
 *
 * Same rule as {@link authSecret} in ./session, for the same reason: a default that is convenient
 * in dev is a published credential in prod, and seeding is the last moment anyone would notice.
 */
export function seedPassword(): string {
  const s = process.env.SEED_PASSWORD;
  if (process.env.NODE_ENV !== 'production') return s || DEMO_PASSWORD;

  if (!s) {
    throw new Error(
      'SEED_PASSWORD is not set — refusing to seed production with the demo password.\n' +
        '  It is published in this repository, and `rahbar` is the account that signs documents.\n' +
        '  SEED_PASSWORD="$(openssl rand -base64 18)" npm run db:seed',
    );
  }
  if (s === DEMO_PASSWORD) throw new Error('SEED_PASSWORD is the published demo password — set a real one');
  if (s.length < 8) throw new Error('SEED_PASSWORD is shorter than 8 characters');
  return s;
}
