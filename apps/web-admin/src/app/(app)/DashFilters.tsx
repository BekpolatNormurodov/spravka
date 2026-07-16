'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select, type Option, type FirmOpt } from '@spravka/shared/ui';

const RANGES: Option[] = [
  { value: '6', label: 'Oxirgi 6 oy' },
  { value: '12', label: 'Oxirgi 12 oy' },
  { value: '24', label: 'Oxirgi 24 oy' },
];

/** Dashboard scope: month window + firm. URL-driven so the view is shareable. */
export function DashFilters({ firms }: { firms: FirmOpt[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function apply(next: Record<string, string>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  const months = sp.get('months') ?? '12';
  const firm = sp.get('firm') ?? '';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const active = !!(sp.get('months') || firm || from || to);

  return (
    <div className="card mb-6 p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Select label="Davr" value={months} onChange={(v) => apply({ months: v })} options={RANGES} />
        <Select
          label="Firma"
          placeholder="Barcha firmalar"
          value={firm}
          onChange={(v) => apply({ firm: v })}
          options={[
            { value: '', label: 'Barcha firmalar' },
            ...firms.map<Option>((f) => ({ value: f.id, label: f.shortName ?? f.name })),
          ]}
        />
        <input type="date" className="field-input" value={from} onChange={(e) => apply({ from: e.target.value })} aria-label="Sanadan" title="Sanadan" />
        <input type="date" className="field-input" value={to} onChange={(e) => apply({ to: e.target.value })} aria-label="Sanagacha" title="Sanagacha" />
      </div>
      {active && (
        <button onClick={() => router.push(pathname)} type="button" className="mt-3 cursor-pointer text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
          Filtrlarni tozalash
        </button>
      )}
    </div>
  );
}
