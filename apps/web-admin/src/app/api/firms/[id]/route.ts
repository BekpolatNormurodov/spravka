import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { firmData, firmError } from '@/lib/firm-body';

/**
 * Edit a firm. Only NEW certificates pick the change up in their letterhead/signature —
 * an already-signed maʼlumotnoma renders from its own `firmSnapshot` and is never rewritten.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const data = firmData(b);
  const bad = firmError(data);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });

  const exists = await prisma.firm.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 404 });

  await prisma.firm.update({
    where: { id: params.id },
    data: { ...data, ...(typeof b.isActive === 'boolean' ? { isActive: b.isActive } : {}) },
  });

  return NextResponse.json({ ok: true });
}
