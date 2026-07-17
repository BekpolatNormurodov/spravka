import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { serveAttachment } from '@spravka/shared/attachments';

export const dynamic = 'force-dynamic';

/** Workflow attachments are internal — a signed-in role only, never public. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return new Response('Unauthorized', { status: 401 });

  const row = await prisma.eventAttachment.findUnique({
    where: { id: params.id },
    select: { fileName: true, path: true, mime: true, size: true, event: { select: { certificate: { select: { deletedAt: true } } } } },
  });
  // An archived ariza takes its attachments out of reach with it.
  if (!row || row.event.certificate.deletedAt) return new Response('Topilmadi', { status: 404 });

  return serveAttachment(row);
}
