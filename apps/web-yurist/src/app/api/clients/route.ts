import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { isValidPinfl } from '@spravka/shared/core';

/** PINFL lookup — the ariza form calls this to autofill a repeat client. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const pinfl = new URL(req.url).searchParams.get('pinfl') ?? '';
  if (!isValidPinfl(pinfl)) {
    return NextResponse.json({ error: 'PINFL 14 ta raqamdan iborat boʻlishi kerak' }, { status: 400 });
  }

  const client = await prisma.client.findUnique({
    where: { pinfl },
    select: {
      id: true, pinfl: true, fullName: true, passport: true,
      passportIssuedBy: true, passportIssuedAt: true, phone: true, address: true,
      _count: { select: { certificates: true } },
    },
  });

  return NextResponse.json({ found: !!client, client });
}
