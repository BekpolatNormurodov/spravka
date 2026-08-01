import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { peekIshonchnomaNumber } from '@spravka/shared/db';
import { NewIshonchnomaSheet } from './NewIshonchnomaSheet';

export const dynamic = 'force-dynamic';

const today = () => new Date().toISOString().slice(0, 10);

/** A blank «Ишончнома» issued by the chosen firm. */
export default async function NewIshonchnomaPage({ params }: { params: { firmId: string } }) {
  const firm = await prisma.firm.findFirst({
    where: { id: params.firmId, isActive: true },
    select: {
      id: true, name: true, shortName: true, letterheadName: true,
      stir: true, bankAccount: true, mfo: true, bankName: true, address: true,
      directorName: true, directorPosition: true,
    },
  });
  if (!firm) notFound();

  const nextNumber = await peekIshonchnomaNumber(new Date(`${today()}T00:00:00.000Z`));
  return <NewIshonchnomaSheet firm={firm} nextNumber={nextNumber} />;
}
