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

  // A RAHBAR is a firm's director: they must belong to a firm, and a firm has exactly one.
  if (b.role === Role.RAHBAR) {
    if (!b.firmId) return NextResponse.json({ error: 'Rahbar uchun firma majburiy' }, { status: 400 });
    const firm = await prisma.firm.findUnique({ where: { id: b.firmId }, select: { id: true, name: true } });
    if (!firm) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 400 });
    const taken = await prisma.user.findFirst({
      where: { role: Role.RAHBAR, firmId: b.firmId, isActive: true,  },
      select: { fullName: true },
    });
    if (taken) {
      return NextResponse.json(
        { error: `Bu firmada allaqachon rahbar bor: ${taken.fullName}` },
        { status: 409 },
      );
    }
  }


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
      firmId: b.role === Role.RAHBAR ? b.firmId : null,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: user.id });
}
