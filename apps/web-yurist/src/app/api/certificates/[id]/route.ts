import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import {
  canEdit, isValidPinfl, parseContracts, Role, missingFieldsError, type CertField,
} from '@spravka/shared/core';

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
  // The same list the ariza was created against — an edit may not leave it emptier than it began.
  const REQUIRED = [
    'personPinfl', 'personFullName', 'personPassport', 'loanAmount', 'asOfDate', 'issueDate',
  ] as const satisfies readonly CertField[];
  const missing = missingFieldsError(b, REQUIRED);
  if (missing) return NextResponse.json({ error: missing }, { status: 400 });
  if (!isValidPinfl(b.personPinfl)) {
    return NextResponse.json({ error: 'PINFL 14 ta raqamdan iborat boʻlishi kerak' }, { status: 400 });
  }

  const parsed = parseContracts(b.contracts);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const passportIssuedAt = b.passportIssuedAt ? new Date(b.passportIssuedAt) : null;

  const person = {
    fullName: b.personFullName,
    passport: b.personPassport,
    passportIssuedBy: b.passportIssuedBy || null,
    passportIssuedAt,
  };

  await prisma.$transaction(async (tx) => {
    /*
      A draft may have been saved without a PINFL, which leaves it with no client. When one is
      typed in later this is where the link finally gets made — otherwise the ariza would stay
      detached from the person for good, and their next one would not find them.
    */
    let clientId = cert.clientId;
    if (b.personPinfl) {
      const client = await tx.client.upsert({
        where: { pinfl: b.personPinfl },
        create: { pinfl: b.personPinfl, ...person, createdById: session.sub },
        update: person,
        select: { id: true },
      });
      clientId = client.id;
    } else if (clientId) {
      // Keep the linked client in step so future arizas autofill the corrected data.
      await tx.client.update({ where: { id: clientId }, data: person });
    }

    await tx.certificate.update({
      where: { id: params.id },
      data: {
        personFullName: b.personFullName,
        personPassport: b.personPassport,
        passportIssuedBy: b.passportIssuedBy || null,
        passportIssuedAt,
        personPinfl: b.personPinfl || null,
        clientId,
        // Rows carry no stable identity across an edit, so the list is replaced rather than diffed
        // — the same rule the admin's route follows.
        contracts: { deleteMany: {}, create: parsed.contracts },
        contractType: b.contractType || undefined,
        loanAmount: String(b.loanAmount).replace(/[\s,]/g, ''),
        asOfDate: new Date(b.asOfDate),
        // What prints. The date beside it is derived, and is not what the document says.
        asOfText: b.asOfText || null,
        // Blank and absent both clear the «Маълумот учун:» line — an edit that removes it has to
        // be able to say so, and an empty string is exactly how the sheet says it.
        infoRecipient: typeof b.infoRecipient === 'string' ? b.infoRecipient.trim() || null : null,
        issueDate: new Date(b.issueDate),
      },
    });
  });

  return NextResponse.json({ ok: true });
}
