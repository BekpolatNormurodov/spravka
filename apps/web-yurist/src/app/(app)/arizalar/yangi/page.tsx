import { prisma } from '@/lib/prisma';
import { PageHeader } from '@spravka/shared/ui';
import { CreateAriza } from './CreateAriza';

export const dynamic = 'force-dynamic';

export default async function NewArizaPage() {
  const firms = await prisma.firm.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    // Rekvizitlar too: the side panel shows what the chosen firm's blank will print.
    select: {
      id: true, name: true, shortName: true, letterheadName: true,
      stir: true, bankAccount: true, mfo: true, bankName: true,
      directorName: true, directorPosition: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="Yangi ariza"
        subtitle="Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnoma uchun maʼlumotlarni kiriting"
      />
      <CreateAriza firms={firms} />
    </div>
  );
}
