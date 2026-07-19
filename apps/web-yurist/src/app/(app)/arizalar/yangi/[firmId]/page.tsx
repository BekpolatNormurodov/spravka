import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { peekCertNumber } from '@spravka/shared/db';
import { NewArizaSheet } from './NewArizaSheet';

export const dynamic = 'force-dynamic';

const today = () => new Date().toISOString().slice(0, 10);

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

  // The number this ariza would get if saved right now, so the sheet does not open with an empty
  // top table. Nothing is reserved by asking — see peekCertNumber.
  const nextNumber = await peekCertNumber(firm.id, new Date(`${today()}T00:00:00.000Z`));

  return <NewArizaSheet firm={firm} nextNumber={nextNumber} />;
}
