import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

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
  const name = firm.letterheadName || firm.name;

  const cards = [
    {
      href: `/arizalar/yangi/${firm.id}/malumotnoma`,
      title: 'Maʼlumotnoma',
      hint: 'Qarzdorlik yoʻqligi toʻgʻrisida — firmaning oʻz blankasida.',
    },
    {
      href: `/arizalar/yangi/${firm.id}/ariza`,
      title: 'Savdo-sanoat palatasiga ariza',
      hint: 'Sud buyrugʻi berish haqida — palata blankasida, firma nomidan.',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-lg font-semibold">Yangi hujjat</h1>
      <p className="mb-6 mt-1 text-sm text-muted">{name} — qanday hujjat yaratamiz?</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="card group flex flex-col gap-2 p-6 transition hover:border-accent/60 hover:shadow-lg"
          >
            <h2 className="font-semibold group-hover:text-accent">{c.title}</h2>
            <p className="text-sm text-muted">{c.hint}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
