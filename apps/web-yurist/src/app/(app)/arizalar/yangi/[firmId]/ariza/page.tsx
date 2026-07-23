import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { peekArizaNumber } from '@spravka/shared/db';
import { NewCourtArizaSheet } from './NewCourtArizaSheet';

export const dynamic = 'force-dynamic';

const today = () => new Date().toISOString().slice(0, 10);

/** A blank «Savdo-sanoat palatasiga ariza» filed on behalf of the chosen firm. */
export default async function NewCourtArizaPage({ params }: { params: { firmId: string } }) {
  const firm = await prisma.firm.findFirst({
    where: { id: params.firmId, isActive: true },
    select: {
      id: true, name: true, shortName: true, letterheadName: true,
      stir: true, bankAccount: true, mfo: true, bankName: true, phone: true, address: true,
      directorName: true, directorPosition: true, executorName: true, executorPhone: true,
    },
  });
  if (!firm) notFound();

  // The register number is per-year and firm-independent — nothing is reserved by asking.
  const nextNumber = await peekArizaNumber(new Date(`${today()}T00:00:00.000Z`));
  return <NewCourtArizaSheet firm={firm} nextNumber={nextNumber} />;
}
