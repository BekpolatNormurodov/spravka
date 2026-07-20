import { redirect } from 'next/navigation';
import { Role } from '@spravka/shared/core';
import { prisma } from './prisma';
import { getSession } from './session';

/**
 * The firm this rahbar is bound to, or null when they are not entitled to act as one.
 *
 * Read from the row, not from the session token: the JWT lives 7 days, and a rahbar moved to
 * another firm — or deactivated — must lose the old firm on the next request, not the next login.
 * One extra query per request, on pages that already make several.
 *
 * Null means: no session, not a RAHBAR, deactivated, or attached to no firm. Every one of those
 * is "acts on nothing", never "acts on everything".
 */
export async function rahbarFirmId(): Promise<string | null> {
  const session = await getSession();
  if (!session || session.role !== Role.RAHBAR) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { firmId: true, isActive: true, role: true },
  });
  if (!user?.isActive || user.role !== Role.RAHBAR || !user.firmId) return null;

  return user.firmId;
}

/**
 * The firm scope for a page. Anyone without one is logged out rather than shown an unscoped list —
 * every certificate query in this app is filtered by the value it returns.
 *
 * Logged out, not merely sent to `/login`. Redirecting there while the cookie is still set is a
 * loop: the middleware bounces `/login` back to `/` for any valid RAHBAR token, and `/` comes
 * straight back here. A rahbar deactivated or moved off their firm mid-token satisfies both ends
 * at once and the browser ping-pongs until it gives up — which is what happened when the seed
 * deactivated the old shared `rahbar` account while a live token was still in a browser.
 */
export async function requireRahbarFirmId(): Promise<string> {
  const firmId = await rahbarFirmId();
  if (!firmId) redirect('/api/auth/expired');
  return firmId;
}
