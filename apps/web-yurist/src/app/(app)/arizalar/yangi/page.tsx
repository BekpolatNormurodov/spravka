import { prisma } from '@/lib/prisma';
import { CreateAriza } from './CreateAriza';

export const dynamic = 'force-dynamic';

export default async function NewArizaPage() {
  const firms = await prisma.firm.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, shortName: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Yangi ariza</h1>
      <p className="text-sm text-slate-400 mb-6">Qarzdorlik yoʻqligi toʻgʻrisidagi maʼlumotnoma uchun maʼlumotlarni kiriting</p>
      <CreateAriza firms={firms} />
    </div>
  );
}
