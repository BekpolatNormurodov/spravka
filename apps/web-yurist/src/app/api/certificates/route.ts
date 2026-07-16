import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { nextCertNumber } from '@/lib/cert-number';
import { CertStatus, WfAction, isValidPinfl, parseContracts } from '@spravka/shared/core';

const REQUIRED = [
  'firmId', 'personPinfl', 'personFullName', 'personPassport',
  'loanAmount', 'asOfDate', 'issueDate',
] as const;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  for (const k of REQUIRED) {
    if (!b[k]) return NextResponse.json({ error: `Maydon toʻldirilmagan: ${k}` }, { status: 400 });
  }

  if (!isValidPinfl(b.personPinfl)) {
    return NextResponse.json({ error: 'PINFL 14 ta raqamdan iborat boʻlishi kerak' }, { status: 400 });
  }

  const parsed = parseContracts(b.contracts);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const firm = await prisma.firm.findUnique({ where: { id: b.firmId }, select: { id: true } });
  if (!firm) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 400 });

  const passportIssuedAt = b.passportIssuedAt ? new Date(b.passportIssuedAt) : null;

  // Upsert the reusable client record — future arizas look this up by PINFL.
  const client = await prisma.client.upsert({
    where: { pinfl: b.personPinfl },
    create: {
      pinfl: b.personPinfl,
      fullName: b.personFullName,
      passport: b.personPassport,
      passportIssuedBy: b.passportIssuedBy || null,
      passportIssuedAt,
      createdById: session.sub,
    },
    update: {
      fullName: b.personFullName,
      passport: b.personPassport,
      passportIssuedBy: b.passportIssuedBy || null,
      passportIssuedAt,
    },
    select: { id: true },
  });

  const issueDate = new Date(b.issueDate);
  const { seq, number } = await nextCertNumber(firm.id, issueDate);
  const submit = b.action === 'submit';

  const cert = await prisma.certificate.create({
    data: {
      id: nanoid(12),
      number,
      seq,
      issueDate,
      firmId: firm.id,
      status: submit ? CertStatus.ADMIN_REVIEW : CertStatus.DRAFT,
      // Snapshot of the person as of issuing — editing the Client later must not
      // rewrite an already-issued document.
      clientId: client.id,
      personPinfl: b.personPinfl,
      personFullName: b.personFullName,
      personPassport: b.personPassport,
      passportIssuedBy: b.passportIssuedBy || null,
      passportIssuedAt,
      contracts: { create: parsed.contracts },
      contractType: b.contractType || undefined,
      loanAmount: String(b.loanAmount).replace(/[\s,]/g, ''),
      asOfDate: new Date(b.asOfDate),
      createdById: session.sub,
      ...(submit
        ? {
            events: {
              create: {
                actorId: session.sub,
                action: WfAction.SUBMIT,
                fromStatus: CertStatus.DRAFT,
                toStatus: CertStatus.ADMIN_REVIEW,
              },
            },
          }
        : {}),
    },
    select: { id: true, number: true },
  });

  return NextResponse.json({ ok: true, id: cert.id, number: cert.number });
}
