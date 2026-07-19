import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { nextCertNumber } from '@/lib/cert-number';
import { CertStatus, WfAction, isValidPinfl, parseContracts } from '@spravka/shared/core';

const REQUIRED = [
  'firmId', 'personFullName', 'personPassport',
  'loanAmount', 'asOfDate', 'issueDate',
] as const;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const submit = b.action === 'submit';

  for (const k of REQUIRED) {
    if (!b[k]) return NextResponse.json({ error: `Maydon toʻldirilmagan: ${k}` }, { status: 400 });
  }

  /*
    PINFL is what identifies the client, not what the document says — the maʼlumotnoma never prints
    it. So a draft may be saved without one: the yurist is often part-way through, working from a
    contract that has the name and the passport in front of it and the PINFL somewhere else.

    Submitting is the point of no return for that: an ariza that reaches the admin without a PINFL
    leaves a client the system can never match to their next one.
  */
  if (submit && !b.personPinfl) {
    return NextResponse.json(
      { error: 'Yuborishdan oldin PINFL kiriting — mijoz shu raqam boʻyicha taniladi' },
      { status: 400 },
    );
  }
  if (b.personPinfl && !isValidPinfl(b.personPinfl)) {
    return NextResponse.json({ error: 'PINFL 14 ta raqamdan iborat boʻlishi kerak' }, { status: 400 });
  }

  const parsed = parseContracts(b.contracts);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const firm = await prisma.firm.findUnique({ where: { id: b.firmId }, select: { id: true } });
  if (!firm) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 400 });

  const passportIssuedAt = b.passportIssuedAt ? new Date(b.passportIssuedAt) : null;

  // The reusable client record — future arizas look this up by PINFL. Skipped for a draft saved
  // without one: `Client.pinfl` is the table's identity, so there is nothing to key a row on. The
  // link is made when the PINFL arrives, on the edit that adds it.
  const client = b.personPinfl
    ? await prisma.client.upsert({
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
      })
    : null;

  const issueDate = new Date(b.issueDate);
  const { seq, number } = await nextCertNumber(firm.id, issueDate);

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
      clientId: client?.id ?? null,
      personPinfl: b.personPinfl || null,
      personFullName: b.personFullName,
      personPassport: b.personPassport,
      passportIssuedBy: b.passportIssuedBy || null,
      passportIssuedAt,
      contracts: { create: parsed.contracts },
      contractType: b.contractType || undefined,
      loanAmount: String(b.loanAmount).replace(/[\s,]/g, ''),
      asOfDate: new Date(b.asOfDate),
      // What prints. The date beside it is derived, and is not what the document says.
      asOfText: b.asOfText || null,
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
