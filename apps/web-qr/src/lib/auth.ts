import { SignJWT, jwtVerify } from "jose";
import { authSecret } from "@spravka/shared/core";

/**
 * Shared, not local. This was `process.env.AUTH_SECRET || "dev-secret-change-me"` — a published
 * 20-character string, evaluated at module load, with none of the production guards the role apps
 * have. Unset in production it signed happily, and anyone who had read this repo could forge
 * `{username, role:"admin"}` and own the dashboard. Nothing about it looked wrong.
 *
 * Called per use rather than captured once: the guard has to run against the runtime env, and a
 * module-level constant would also freeze a value read before the process had one.
 */
const secret = () => authSecret();

export const COOKIE_NAME = "qrp_session";

/** This app's own role claim — deliberately not one of the spravka Role values. */
const ROLE = "admin";

export async function createSession(username: string): Promise<string> {
  return new SignJWT({ username, role: ROLE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
}

export async function verifySession(
  token: string | undefined
): Promise<{ username: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    // Check what the token claims to be, not just that it verifies. Every app in the
    // monorepo now reads an AUTH_SECRET from its own .env; if an operator reuses one
    // value across apps, a role token from the spravka side would otherwise satisfy
    // jwtVerify here and land as { username: "undefined" } — truthy, and enough to
    // open this dashboard. Mirrors the VALID_ROLES guard in @spravka/shared/core.
    if (payload.role !== ROLE) return null;
    const username = payload.username;
    if (typeof username !== "string" || !username) return null;
    return { username };
  } catch {
    return null;
  }
}

export function checkCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  return username === u && password === p;
}
