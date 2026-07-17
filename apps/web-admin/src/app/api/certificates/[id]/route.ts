import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { WfAction, findTransition, canEdit, isValidPinfl, parseContracts } from '@spravka/shared/core';
import { readActionRequest, discard } from '@spravka/shared/attachments';

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

  const cert = await prisma.certificate.findUnique({
    where: { id: params.id },
    select: { status: true, deletedAt: true },
  });
  if (!cert || cert.deletedAt) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

  const existingCount = await prisma.eventAttachment.count({
    where: { event: { certificateId: params.id } },
  });

  const intake = await readActionRequest(req, { existingCount });
  if ('error' in intake) return NextResponse.json({ error: intake.error }, { status: 400 });

  const fail = async (error: string, status: number) => {
    await discard(intake.files);
    return NextResponse.json({ error }, { status });
  };

  const wf = ACTION_MAP[intake.action];
  if (!wf) return fail('Notoʻgʻri amal', 400);

  // Returning to the yurist must explain why — they act on this text.
  if (wf === WfAction.RETURN && !intake.note) return fail('Qaytarish sababi majburiy', 400);

  const t = findTransition(cert.status, session.role, wf);
  if (!t) return fail('Bu holatda amalni bajarib boʻlmaydi', 400);

  try {
    await prisma.$transaction([
      prisma.certificate.update({ where: { id: params.id }, data: { status: t.to } }),
      prisma.workflowEvent.create({
        data: {
          certificateId: params.id,
          actorId: session.sub,
          action: wf,
          fromStatus: t.from,
          toStatus: t.to,
          note: intake.note,
          attachments: { create: intake.files },
        },
      }),
    ]);
  } catch (err) {
    // Files with no event are orphaned bytes — drop them so a retry starts clean.
    await discard(intake.files);
    throw err;
  }

  return NextResponse.json({ ok: true, status: t.to });
}
