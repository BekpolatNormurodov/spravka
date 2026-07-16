import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@spravka/shared/password';
import { createSession, COOKIE_NAME, Role } from '@spravka/shared/core';

export async function POST(req: Request) {
  const { login, password } = await req.json().catch(() => ({}));
  if (!login || !password) {
    return NextResponse.json({ error: 'Login va parol kiriting' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { login } });
  if (
    !user ||
    !user.isActive ||
    user.role !== Role.ADMIN ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    return NextResponse.json({ error: 'Login yoki parol xato' }, { status: 401 });
  }

  const token = await createSession({
    sub: user.id,
    login: user.login,
    role: user.role,
    fullName: user.fullName,
  });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
