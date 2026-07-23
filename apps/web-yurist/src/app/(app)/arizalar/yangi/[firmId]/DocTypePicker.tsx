'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Ico } from '@spravka/shared/ui';

/** The two documents a yurist can start on a firm. Keywords widen what the search matches. */
const CARDS = [
  {
    key: 'malumotnoma',
    slug: 'malumotnoma',
    title: 'Maʼlumotnoma',
    hint: 'Qarzdorlik yoʻqligi toʻgʻrisida — firmaning oʻz blankasida.',
    tag: 'Firma blankasi',
    Icon: Ico.files,
    badge: 'bg-accent-500/10 text-accent-600 dark:text-accent-400',
    hover: 'hover:border-accent-500/50',
    keywords: 'malumotnoma qarzdorlik yoq firma blanka spravka',
  },
  {
    key: 'ariza',
    slug: 'ariza',
    title: 'Savdo-sanoat palatasiga ariza',
    hint: 'Sud buyrugʻi berish haqida — palata blankasida, firma nomidan.',
    tag: 'Palata blankasi',
    Icon: Ico.building,
    badge: 'bg-brand-500/10 text-brand-600 dark:text-brand-300',
    hover: 'hover:border-brand-500/50',
    keywords: 'ariza sud buyruq palata savdo sanoat qarz undirish',
  },
] as const;

const norm = (s: string) => s.toLowerCase().replace(/[ʻ']/g, '');

export function DocTypePicker({ firmId, firmName }: { firmId: string; firmName: string }) {
  const [q, setQ] = useState('');
  const query = norm(q.trim());
  const shown = CARDS.filter((c) => !query || norm(`${c.title} ${c.keywords}`).includes(query));

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-xl font-semibold tracking-tight">Qanday hujjat yaratmoqchisiz?</h1>
      <p className="mt-1 text-sm text-muted">{firmName}</p>

      <div className="mt-5">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Hujjat turini qidiring…"
          aria-label="Hujjat turini qidirish"
          autoFocus
          className="w-full rounded-xl border border-line bg-surface px-4 py-2.5 text-sm outline-none transition focus:border-accent-500/60 focus:ring-2 focus:ring-accent-500/20"
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {shown.map((c) => (
          <Link
            key={c.key}
            href={`/arizalar/yangi/${firmId}/${c.slug}`}
            className={`card group flex flex-col gap-3 p-6 transition hover:-translate-y-0.5 hover:shadow-lg ${c.hover}`}
          >
            <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${c.badge}`}>
              <c.Icon size={22} />
            </span>
            <div>
              <h2 className="font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-muted">{c.hint}</p>
            </div>
            <span className="mt-auto inline-flex w-fit items-center rounded-full border border-line px-2.5 py-0.5 text-[11px] text-muted">
              {c.tag}
            </span>
          </Link>
        ))}
      </div>

      {shown.length === 0 && (
        <p className="mt-8 text-center text-sm text-muted">
          «{q}» boʻyicha hujjat turi topilmadi.
        </p>
      )}
    </div>
  );
}
