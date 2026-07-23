import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { peekCertNumber } from '@spravka/shared/db';
import { NewArizaSheet } from '../NewArizaSheet';

export const dynamic = 'force-dynamic';

const today = () => new Date().toISOString().slice(0, 10);

/** A blank maʼlumotnoma on the chosen firm's letterhead. */
export default async function NewMalumotnomaPage({ params }: { params: { firmId: string } }) {
  const firm = await prisma.firm.findFirst({
    where: { id: params.firmId, isActive: true },
    select: {
      id: true, name: true, shortName: true, letterheadName: true,
      stir: true, bankAccount: true, mfo: true, bankName: true, phone: true, address: true,
      directorName: true, directorPosition: true, executorName: true, executorPhone: true,
    },
  });
  if (!firm) notFound();

  const nextNumber = await peekCertNumber(firm.id, new Date(`${today()}T00:00:00.000Z`));
  return <NewArizaSheet firm={firm} nextNumber={nextNumber} />;
}
