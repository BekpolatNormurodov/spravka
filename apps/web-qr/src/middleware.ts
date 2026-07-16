import { NextRequest, NextResponse } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/auth";

/**
 * Deny by default — the matcher below covers every path, and anything not listed
 * here needs a session. The old matcher named the paths to *protect*, so a new
 * route was public until someone remembered to add it; that is how three
 * /api/debug/* routes ended up serving the admin password and the QR table to
 * anyone who asked. The sibling apps (web-admin, web-yurist, web-rahbar) all
 * deny by default; this now matches them.
 *
 * These must stay open — they are the scan surface a QR code points at:
 *   /q/<id>            the landing a scanner hits
 *   /qr/<id>.png       the generated QR image (public/qr + the runtime fallback route)
 *   /uploads/<file>    what a FILE/IMAGE code serves (public/uploads)
 *   /api/download/<id> the forced download a FILE code triggers
 *   /api/auth/*        login and logout themselves
 */
const PUBLIC = [/^\/q\//, /^\/qr\//, /^\/uploads\//, /^\/api\/download\//, /^\/api\/auth\//];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = await verifySession(req.cookies.get(COOKIE_NAME)?.value);
  const isAuthed = !!session;

  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  if (pathname === "/login") {
    return isAuthed ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  }

  if (!isAuthed) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.svg).*)"],
};
