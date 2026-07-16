import React from 'react';
import Link from 'next/link';
import { CertStatus, STATUS_LABELS } from '../core';
import { STATUS_DOT } from './tokens';

export const UZ_MONTHS_LAT = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
] as const;

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

export { STATUS_DOT } from './tokens';

export interface DayData {
  total: number;
  counts: Record<string, number>;
}

/** Month grid. Server-rendered links — no client state, instant navigation. */
export function Calendar({
  month,
  days,
  selected,
  todayIso,
  hrefForDay,
  prevHref,
  nextHref,
  todayHref,
}: {
  /** 'YYYY-MM' */
  month: string;
  /** keyed by 'YYYY-MM-DD' */
  days: Record<string, DayData>;
  selected?: string;
  todayIso: string;
  hrefForDay: (iso: string) => string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
}) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y!, m! - 1, 1));
  const startWd = (first.getUTCDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(Date.UTC(y!, m!, 0)).getUTCDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWd; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const iso = (d: number) => `${month}-${String(d).padStart(2, '0')}`;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold">
          {UZ_MONTHS_LAT[m! - 1]} <span className="text-muted tabular-nums">{y}</span>
        </h2>
        <div className="flex items-center gap-1">
          <Link href={prevHref} aria-label="Oldingi oy" className="btn-ghost px-2.5 py-1.5 text-xs">←</Link>
          <Link href={todayHref} className="btn-ghost px-3 py-1.5 text-xs">Bugun</Link>
          <Link href={nextHref} aria-label="Keyingi oy" className="btn-ghost px-2.5 py-1.5 text-xs">→</Link>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 border-b border-line bg-surface-2">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide ${i >= 5 ? 'text-rose-500/70' : 'text-muted'}`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (d === null) return <div key={`e${i}`} className="min-h-[86px] border-b border-r border-line/60 bg-surface-2/30" />;
          const key = iso(d);
          const data = days[key];
          const isToday = key === todayIso;
          const isSel = key === selected;
          const weekend = i % 7 >= 5;

          return (
            <Link
              key={key}
              href={hrefForDay(key)}
              aria-label={`${d}-kun${data ? `, ${data.total} ta ariza` : ''}`}
              aria-current={isSel ? 'date' : undefined}
              className={`group relative min-h-[86px] border-b border-r border-line/60 p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500/40 ${
                isSel ? 'bg-brand-600/10 ring-1 ring-inset ring-brand-500/40' : 'hover:bg-surface-2'
              }`}
            >
              <span
                className={`inline-grid h-6 w-6 place-items-center rounded-full text-xs font-semibold tabular-nums ${
                  isToday ? 'bg-brand-600 text-white' : weekend ? 'text-rose-500/80' : 'text-fg'
                }`}
              >
                {d}
              </span>

              {data && (
                <div className="mt-1.5 space-y-1">
                  {Object.entries(data.counts).map(([st, n]) => (
                    <div key={st} className="flex items-center gap-1.5" title={`${STATUS_LABELS[st as CertStatus]}: ${n}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[st] ?? 'bg-slate-400'}`} />
                      <span className="truncate text-[11px] text-muted tabular-nums">{n}</span>
                    </div>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Legend — colour is never the only cue (label + count) */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-3">
        {Object.values(CertStatus).map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted">
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[s]}`} />
            {STATUS_LABELS[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
