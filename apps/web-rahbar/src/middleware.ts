import { NextRequest, NextResponse } from 'next/server';
import { verifySession, COOKIE_NAME, Role } from '@spravka/shared/core';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  const isRahbar = session?.role === Role.RAHBAR;

  if (pathname.startsWith('/api/auth')) return NextResponse.next();

  if (pathname === '/login') {
    return isRahbar ? NextResponse.redirect(new URL('/', req.url)) : NextResponse.next();
  }

  if (!isRahbar) {
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
