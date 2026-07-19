import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { NewArizaSheet } from './NewArizaSheet';

export const dynamic = 'force-dynamic';

/**
 * A blank maʼlumotnoma on the chosen firm's letterhead.
 *
 * The firm is in the URL rather than in the form because it decides the whole page — the
 * letterhead, the rekvizitlar, the signature block. Picking it is navigation, so the browser's
 * back button and a reload both do the obvious thing.
 */
export default async function NewArizaOnFirmPage({ params }: { params: { firmId: string } }) {
  const firm = await prisma.firm.findFirst({
    where: { id: params.firmId, isActive: true },
    select: {
      id: true, name: true, shortName: true, letterheadName: true,
      stir: true, bankAccount: true, mfo: true, bankName: true, phone: true, address: true,
      directorName: true, directorPosition: true, executorName: true, executorPhone: true,
    },
  });
  if (!firm) notFound();

  return <NewArizaSheet firm={firm} />;
}
