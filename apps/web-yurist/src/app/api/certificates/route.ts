import { NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { nextCertNumber } from '@/lib/cert-number';
import { CertStatus, WfAction } from '@spravka/shared/core';

const REQUIRED = [
  'firmId', 'personFullName', 'personPassport',
  'contractNumber', 'contractDate', 'loanAmount', 'asOfDate', 'issueDate',
] as const;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  for (const k of REQUIRED) {
    if (!b[k]) return NextResponse.json({ error: `Maydon toʻldirilmagan: ${k}` }, { status: 400 });
  }

  const firm = await prisma.firm.findUnique({ where: { id: b.firmId }, select: { id: true } });
  if (!firm) return NextResponse.json({ error: 'Firma topilmadi' }, { status: 400 });

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
      personFullName: b.personFullName,
      personPassport: b.personPassport,
      passportIssuedBy: b.passportIssuedBy || null,
      passportIssuedAt: b.passportIssuedAt ? new Date(b.passportIssuedAt) : null,
      contractNumber: b.contractNumber,
      contractDate: new Date(b.contractDate),
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
