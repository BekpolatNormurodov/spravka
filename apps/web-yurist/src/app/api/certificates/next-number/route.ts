import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { peekCertNumber } from '@spravka/shared/db';
import { isValidDay } from '@spravka/shared/core';

/**
 * The number an ariza would get if it were saved now, for showing on one that has not been.
 *
 * Reads only — nothing is reserved. The number embeds the issue date, so the sheet asks again
 * whenever that changes.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const firmId = url.searchParams.get('firmId') ?? '';
  const day = url.searchParams.get('date') ?? '';
  if (!firmId || !isValidDay(day)) {
    return NextResponse.json({ error: 'firmId va date kerak' }, { status: 400 });
  }

  const firm = await prisma.firm.findFirst({ where: { id: firmId, isActive: true }, select: { id: true } });
  if (!firm) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 404 });

  return NextResponse.json({ number: await peekCertNumber(firm.id, new Date(`${day}T00:00:00.000Z`)) });
}
