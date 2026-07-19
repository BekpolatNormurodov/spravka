import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { canEdit, isValidPinfl, parseContracts, Role } from '@spravka/shared/core';

/**
 * A yurist correcting their own ariza before it leaves them.
 *
 * Two guards, and both are needed: `canEdit` stops an ariza being rewritten after it has moved on
 * (core allows a yurist DRAFT and nothing else), and the ownership check stops one yurist editing
 * another's. Neither implies the other.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cert = await prisma.certificate.findUnique({
    where: { id: params.id },
    select: { status: true, deletedAt: true, clientId: true, createdById: true },
  });
  // Someone else's ariza is not "forbidden", it is not theirs to know about.
  if (!cert || cert.deletedAt || cert.createdById !== session.sub) {
    return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
  }

  if (!canEdit(session.role as Role, cert.status)) {
    return NextResponse.json(
      { error: 'Bu holatda tahrirlab boʻlmaydi — ariza koʻrib chiqishga yuborilgan' },
      { status: 403 },
    );
  }

  const b = await req.json().catch(() => ({}));
  const required = ['personFullName', 'personPassport', 'loanAmount', 'asOfDate', 'issueDate'];
  for (const k of required) {
    if (!b[k]) return NextResponse.json({ error: `Maydon toʻldirilmagan: ${k}` }, { status: 400 });
  }
  if (b.personPinfl && !isValidPinfl(b.personPinfl)) {
    return NextResponse.json({ error: 'PINFL 14 ta raqamdan iborat boʻlishi kerak' }, { status: 400 });
  }

  const parsed = parseContracts(b.contracts);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const passportIssuedAt = b.passportIssuedAt ? new Date(b.passportIssuedAt) : null;

  await prisma.$transaction(async (tx) => {
    await tx.certificate.update({
      where: { id: params.id },
      data: {
        personFullName: b.personFullName,
        personPassport: b.personPassport,
        passportIssuedBy: b.passportIssuedBy || null,
        passportIssuedAt,
        // Rows carry no stable identity across an edit, so the list is replaced rather than diffed
        // — the same rule the admin's route follows.
        contracts: { deleteMany: {}, create: parsed.contracts },
        contractType: b.contractType || undefined,
        loanAmount: String(b.loanAmount).replace(/[\s,]/g, ''),
        asOfDate: new Date(b.asOfDate),
        issueDate: new Date(b.issueDate),
      },
    });
    // Keep the linked client in step so future arizas autofill the corrected data.
    if (cert.clientId) {
      await tx.client.update({
        where: { id: cert.clientId },
        data: {
          fullName: b.personFullName,
          passport: b.personPassport,
          passportIssuedBy: b.passportIssuedBy || null,
          passportIssuedAt,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
