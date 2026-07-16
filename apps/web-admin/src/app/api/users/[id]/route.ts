import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { hashPassword } from '@spravka/shared/password';
import { Role } from '@spravka/shared/core';

const ROLES: string[] = [Role.YURIST, Role.ADMIN, Role.RAHBAR];

/** Edit a user. Password is only touched when a new one is supplied. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true, login: true } });
  if (!user) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

  if (!b.fullName?.trim() || b.fullName.trim().split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json({ error: 'Ism va familiyani toʻliq yozing' }, { status: 400 });
  }
  if (!b.login?.trim() || b.login.trim().length < 3) {
    return NextResponse.json({ error: 'Login kamida 3 belgi' }, { status: 400 });
  }
  if (!ROLES.includes(b.role)) {
    return NextResponse.json({ error: 'Notoʻgʻri rol' }, { status: 400 });
  }
  if (b.password && b.password.length < 6) {
    return NextResponse.json({ error: 'Parol kamida 6 belgi' }, { status: 400 });
  }

  // Login must stay unique across users.
  if (b.login.trim() !== user.login) {
    const taken = await prisma.user.findUnique({ where: { login: b.login.trim() }, select: { id: true } });
    if (taken) return NextResponse.json({ error: 'Bu login band' }, { status: 409 });
  }


  // A RAHBAR is a firm's director: they must belong to a firm, and a firm has exactly one.
  if (b.role === Role.RAHBAR) {
    if (!b.firmId) return NextResponse.json({ error: 'Rahbar uchun firma majburiy' }, { status: 400 });
    const firm = await prisma.firm.findUnique({ where: { id: b.firmId }, select: { id: true, name: true } });
    if (!firm) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 400 });
    const taken = await prisma.user.findFirst({
      where: { role: Role.RAHBAR, firmId: b.firmId, isActive: true, id: { not: params.id } },
      select: { fullName: true },
    });
    if (taken) {
      return NextResponse.json(
        { error: `Bu firmada allaqachon rahbar bor: ${taken.fullName}` },
        { status: 409 },
      );
    }
  }

  await prisma.user.update({
    where: { id: params.id },
    data: {
      fullName: b.fullName.trim(),
      login: b.login.trim(),
      role: b.role as Role,
      position: b.position || null,
      phone: b.phone || null,
      firmId: b.role === Role.RAHBAR ? b.firmId : null,
      ...(typeof b.isActive === 'boolean' ? { isActive: b.isActive } : {}),
      ...(b.password ? { passwordHash: await hashPassword(b.password), plainPassword: b.password } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
