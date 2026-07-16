import { NextResponse } from 'next/server';
import { Prisma } from '@spravka/shared/db';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { WfAction, findTransition, canDelete } from '@spravka/shared/core';

const MAP: Record<string, WfAction> = {
  sign: WfAction.SIGN,
  return: WfAction.RETURN,
};

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, note } = await req.json().catch(() => ({}));

  const cert = await prisma.certificate.findUnique({
    where: { id: params.id },
    select: { status: true, deletedAt: true },
  });
  if (!cert || cert.deletedAt) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

  // Soft-delete (RAHBAR-only) — not a status transition.
  if (action === 'delete') {
    if (!canDelete(session.role)) return NextResponse.json({ error: 'Ruxsat yoʻq' }, { status: 403 });
    if (!note?.trim()) return NextResponse.json({ error: 'Sabab majburiy' }, { status: 400 });
    await prisma.$transaction([
      prisma.certificate.update({
        where: { id: params.id },
        data: { deletedAt: new Date(), deletedById: session.sub, deletedReason: note.trim() },
      }),
      prisma.workflowEvent.create({
        data: {
          certificateId: params.id,
          actorId: session.sub,
          action: WfAction.DELETE,
          fromStatus: cert.status,
          toStatus: cert.status,
          note: note.trim(),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, deleted: true });
  }

  const wf = MAP[action];
  if (!wf) return NextResponse.json({ error: 'Notoʻgʻri amal' }, { status: 400 });

  // Returning must explain why — admin/yurist act on this text.
  if (wf === WfAction.RETURN && !note?.trim()) {
    return NextResponse.json({ error: 'Qaytarish sababi majburiy' }, { status: 400 });
  }

  const t = findTransition(cert.status, session.role, wf);
  if (!t) return NextResponse.json({ error: 'Bu holatda amalni bajarib boʻlmaydi' }, { status: 400 });

  const data: Prisma.CertificateUpdateInput = { status: t.to };
  if (wf === WfAction.SIGN) {
    data.signedBy = { connect: { id: session.sub } };
    data.signedAt = new Date();
  }

  await prisma.$transaction([
    prisma.certificate.update({ where: { id: params.id }, data }),
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
