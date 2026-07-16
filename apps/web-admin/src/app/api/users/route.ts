import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { hashPassword } from '@spravka/shared/password';
import { Role } from '@spravka/shared/core';

const ROLES: string[] = [Role.YURIST, Role.ADMIN, Role.RAHBAR];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.fullName || !b.login || !b.password || !ROLES.includes(b.role)) {
    return NextResponse.json({ error: 'Maydonlarni toʻgʻri toʻldiring' }, { status: 400 });
  }

  const exists = await prisma.user.findUnique({ where: { login: b.login }, select: { id: true } });
  if (exists) return NextResponse.json({ error: 'Bu login band' }, { status: 409 });

  const passwordHash = await hashPassword(b.password);
  const user = await prisma.user.create({
    data: {
      fullName: b.fullName,
      login: b.login,
      passwordHash,
      plainPassword: b.password,
      role: b.role as Role,
      position: b.position || null,
      phone: b.phone || null,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: user.id });
}
