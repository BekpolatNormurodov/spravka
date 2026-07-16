import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { WfAction, findTransition, canEdit, isValidPinfl, parseContracts } from '@spravka/shared/core';

/**
 * Edit an ariza's content. Enforces the edit-lock rule from core: ADMIN may edit only while
 * DRAFT/ADMIN_REVIEW. Once approved (DIRECTOR_REVIEW) or SIGNED the document is frozen.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cert = await prisma.certificate.findUnique({
    where: { id: params.id },
    select: { status: true, deletedAt: true, clientId: true },
  });
  if (!cert || cert.deletedAt) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

  if (!canEdit(session.role, cert.status)) {
    return NextResponse.json(
      { error: 'Bu holatda tahrirlab boʻlmaydi — hujjat tasdiqlangan/imzolangan' },
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
        // Rows carry no stable identity across an edit — the admin can add, drop or reorder
        // them — so the list is replaced wholesale rather than diffed.
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

const ACTION_MAP: Record<string, WfAction> = {
  approve: WfAction.APPROVE,
  return: WfAction.RETURN,
};

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, note } = await req.json().catch(() => ({}));
  const wf = ACTION_MAP[action];
  if (!wf) return NextResponse.json({ error: 'Notoʻgʻri amal' }, { status: 400 });

  // Returning to the yurist must explain why — they act on this text.
  if (wf === WfAction.RETURN && !note?.trim()) {
    return NextResponse.json({ error: 'Qaytarish sababi majburiy' }, { status: 400 });
  }

  const cert = await prisma.certificate.findUnique({
    where: { id: params.id },
    select: { status: true, deletedAt: true },
  });
  if (!cert || cert.deletedAt) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

  const t = findTransition(cert.status, session.role, wf);
  if (!t) return NextResponse.json({ error: 'Bu holatda amalni bajarib boʻlmaydi' }, { status: 400 });

  await prisma.$transaction([
    prisma.certificate.update({ where: { id: params.id }, data: { status: t.to } }),
    prisma.workflowEvent.create({
      data: {
        certificateId: params.id,
        actorId: session.sub,
        action: wf,
        fromStatus: t.from,
        toStatus: t.to,
        note: note?.trim() || null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, status: t.to });
}
