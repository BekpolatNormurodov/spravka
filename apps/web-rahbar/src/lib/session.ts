import { cookies } from 'next/headers';
import { verifySession, COOKIE_NAME, type SessionPayload } from '@spravka/shared/core';

/** Read the current signed-in session in a server component / route handler. */
export async function getSession(): Promise<SessionPayload | null> {
  return verifySession(cookies().get(COOKIE_NAME)?.value);
}
