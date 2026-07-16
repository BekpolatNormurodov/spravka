import { NextRequest, NextResponse } from "next/server";
import { verifySession, COOKIE_NAME } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const session = await verifySession(token);

  const isAuthed = !!session;
  const isLoginPage = pathname === "/login";
  const isDashboard = pathname.startsWith("/dashboard");
  const isProtectedApi =
    pathname.startsWith("/api/qr") || pathname.startsWith("/api/upload");

  // Tizimga kirgan bo'lsa login sahifasidan dashboardga yuborish
  if (isAuthed && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Himoyalangan sahifa/apiga kirishni cheklash
  if (!isAuthed && (isDashboard || isProtectedApi)) {
    if (isProtectedApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/api/qr/:path*", "/api/upload"],
};
