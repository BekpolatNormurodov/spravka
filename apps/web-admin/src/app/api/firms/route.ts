import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { firmData, firmError } from '@/lib/firm-body';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const data = firmData(b);
  const bad = firmError(data);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const firm = await prisma.firm.create({ data, select: { id: true } });
  return NextResponse.json({ ok: true, id: firm.id });
}
