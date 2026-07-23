import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { DocTypePicker } from './DocTypePicker';

export const dynamic = 'force-dynamic';

/**
 * «Hujjat yaratish» — after a firm is picked, choose which of the two documents to write. Both open
 * on this firm; the maʼlumotnoma on the firm's own blank, the ariza on the palata's.
 */
export default async function PickDocTypePage({ params }: { params: { firmId: string } }) {
  const firm = await prisma.firm.findFirst({
    where: { id: params.firmId, isActive: true },
    select: { id: true, name: true, shortName: true, letterheadName: true },
  });
  if (!firm) notFound();

  return <DocTypePicker firmId={firm.id} firmName={firm.letterheadName || firm.name} />;
}
