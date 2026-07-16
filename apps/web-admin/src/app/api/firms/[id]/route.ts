import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

/**
 * Edit a firm. Only NEW certificates pick the change up in their letterhead/signature —
 * already-issued documents are not rewritten (they render from this firm live today;
 * snapshotting them is tracked separately).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  if (!b.name?.trim() || !b.directorName?.trim() || !b.executorName?.trim() || !b.phone?.trim()) {
    return NextResponse.json({ error: 'Majburiy maydonlar toʻldirilmagan' }, { status: 400 });
  }
  if (b.directorName.trim().split(/\s+/).filter(Boolean).length < 2) {
    return NextResponse.json({ error: 'Direktorning ism va familiyasini toʻliq yozing' }, { status: 400 });
  }

  const exists = await prisma.firm.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 404 });

  await prisma.firm.update({
    where: { id: params.id },
    data: {
      name: b.name.trim(),
      shortName: b.shortName || null,
      stir: b.stir || null,
      directorName: b.directorName.trim(),
      directorPosition: b.directorPosition || undefined,
      executorName: b.executorName.trim(),
      executorPhone: b.executorPhone || null,
      phone: b.phone.trim(),
      bankName: b.bankName || null,
      bankAccount: b.bankAccount ? String(b.bankAccount).replace(/\s/g, '') : null,
      mfo: b.mfo || null,
      region: b.region || null,
      address: b.address || null,
      ...(typeof b.isActive === 'boolean' ? { isActive: b.isActive } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}
