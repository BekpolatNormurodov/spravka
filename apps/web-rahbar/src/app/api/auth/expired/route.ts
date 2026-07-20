import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@spravka/shared/core';

/**
 * End a session whose account can no longer act, and send it to the login page.
 *
 * The alternative is a redirect loop, and it is not hypothetical — it happened. The middleware
 * bounces `/login` to `/` whenever the cookie holds a valid RAHBAR token, and the app layout
 * bounces `/` to `/login` whenever `requireRahbarFirmId()` comes back empty. A rahbar who is
 * deactivated, or moved off their firm, while holding a live 7-day token satisfies both at once:
 * the browser ping-pongs until it gives up.
 *
 * A page cannot clear a cookie — `cookies().set()` throws during a server render — so the scope
 * helper redirects here instead. A route handler can, and once the cookie is gone the middleware
 * lets `/login` render.
 *
 * GET rather than POST, unlike logout: this is a redirect target, not a form action, and the worst
 * a forged request achieves is logging someone out.
 */
export async function GET() {
  /*
    A relative Location, not `new URL('/login', req.url)`.

    Behind nginx the request URL carries the internal host — `http://rahbar:5103/...` — and building
    an absolute redirect from it sends the browser to a name only the Docker network can resolve.
    Measured in dev, where the same code produced `http://0.0.0.0:5103/login`. A relative Location
    is resolved by the browser against the address it actually typed.
  */
  const res = new NextResponse(null, { status: 303, headers: { Location: '/login' } });
  res.cookies.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
