// Node-only (bcryptjs). Imported via the `@spravka/shared/password` subpath so it never enters an
// edge-runtime bundle (e.g. Next.js middleware). Edge-safe session code lives in ./session.
import bcrypt from 'bcryptjs';

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
