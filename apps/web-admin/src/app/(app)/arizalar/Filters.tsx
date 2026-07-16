'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CertStatus, STATUS_LABELS } from '@spravka/shared/core';
import { Ico } from '@spravka/shared/ui';

type Firm = { id: string; name: string; shortName: string | null };

const STATUSES = [CertStatus.DRAFT, CertStatus.ADMIN_REVIEW, CertStatus.DIRECTOR_REVIEW, CertStatus.SIGNED];

export function Filters({ firms }: { firms: Firm[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [q, setQ] = useState(sp.get('q') ?? '');
  const mounted = useRef(false);

  function apply(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.delete('page'); // any filter change resets to page 1
    router.push(`${pathname}?${p.toString()}`);
  }

  // Debounced search — skip the first run so mounting doesn't navigate.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const t = setTimeout(() => {
      if ((sp.get('q') ?? '') !== q) apply({ q });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const status = sp.get('status') ?? '';
  const firm = sp.get('firm') ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const active = !!(sp.get('q') || status || firm || from || to);

  return (
    <div className="card mb-4 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_auto_auto]">
        {/* Search */}
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <Ico.files size={16} />
          </span>
          <input
            className="field-input pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="№, F.I.SH., passport, shartnoma…"
            aria-label="Qidirish"
          />
        </div>

        {/* Status */}
        <select className="field-input" value={status} onChange={(e) => apply({ status: e.target.value })} aria-label="Holat">
          <option value="">Barcha holatlar</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {/* Firm */}
        <select className="field-input" value={firm} onChange={(e) => apply({ firm: e.target.value })} aria-label="Firma">
          <option value="">Barcha firmalar</option>
          {firms.map((f) => (
            <option key={f.id} value={f.id}>{f.shortName ?? f.name}</option>
          ))}
        </select>

        {/* Date range */}
        <input
          type="date"
          className="field-input"
          value={from}
          onChange={(e) => apply({ from: e.target.value })}
          aria-label="Sanadan"
          title="Sanadan"
        />
        <input
          type="date"
          className="field-input"
          value={to}
          onChange={(e) => apply({ to: e.target.value })}
          aria-label="Sanagacha"
          title="Sanagacha"
        />
      </div>

      {active && (
        <button
          onClick={() => {
            setQ('');
            router.push(pathname);
          }}
          className="mt-3 cursor-pointer text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          type="button"
        >
          Filtrlarni tozalash
        </button>
      )}
    </div>
  );
}
