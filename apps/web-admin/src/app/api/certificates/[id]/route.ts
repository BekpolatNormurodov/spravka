import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { WfAction, findTransition } from '@spravka/shared/core';

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
        note: note || null,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, status: t.to });
}
