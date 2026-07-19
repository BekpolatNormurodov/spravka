import { prisma } from '@/lib/prisma';
import { EmptyState } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

/**
 * The state between «Yangi ariza» and a document: the sidebar is showing the firms and nothing has
 * been picked yet. The list itself lives in the sidebar (see the (app) layout) — repeating it here
 * would give the same choice two places to be made.
 */
export default async function PickFirmPage() {
  const count = await prisma.firm.count({ where: { isActive: true } });

  return (
    <EmptyState
      title="Firmani tanlang"
      hint={
        count
          ? 'Chapdagi roʻyxatdan mikromoliya tashkilotini tanlang — maʼlumotnoma oʻsha firmaning blankasida ochiladi.'
          : 'Faol firma yoʻq. Maʼlumotnoma yozish uchun administrator kamida bitta firma qoʻshishi kerak.'
      }
    />
  );
}
