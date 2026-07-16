import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.name || !b.directorName || !b.executorName || !b.phone) {
    return NextResponse.json({ error: 'Majburiy maydonlar toʻldirilmagan' }, { status: 400 });
  }

  const firm = await prisma.firm.create({
    data: {
      name: b.name,
      shortName: b.shortName || null,
      stir: b.stir || null,
      directorName: b.directorName,
      executorName: b.executorName,
      executorPhone: b.executorPhone || null,
      phone: b.phone,
      region: b.region || null,
      address: b.address || null,
    },
    select: { id: true },
  });
  return NextResponse.json({ ok: true, id: firm.id });
}
