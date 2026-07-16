'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Select, DatePicker, type Option } from '@spravka/shared/ui';

const RANGES: Option[] = [
  { value: '6', label: 'Oxirgi 6 oy' },
  { value: '12', label: 'Oxirgi 12 oy' },
  { value: '24', label: 'Oxirgi 24 oy' },
];

/**
 * Dashboard scope: month window and date range. URL-driven so the view is shareable.
 *
 * No firm control — a rahbar has exactly one, and the page is scoped to it server-side. Offering
 * the choice would be a control that cannot change anything.
 */
export function DashFilters() {
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
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const active = !!(sp.get('months') || from || to);

  return (
    <div className="card mb-6 p-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Select label="Davr" value={months} onChange={(v) => apply({ months: v })} options={RANGES} />
        {/* Each end bounds the other, so an impossible range cannot be picked. */}
        <DatePicker
          value={from}
          onChange={(v) => apply({ from: v })}
          max={to || undefined}
          ariaLabel="Sanadan"
          placeholder="Sanadan"
        />
        <DatePicker
          value={to}
          onChange={(v) => apply({ to: v })}
          min={from || undefined}
          ariaLabel="Sanagacha"
          placeholder="Sanagacha"
        />
      </div>
      {active && (
        <button onClick={() => router.push(pathname)} type="button" className="mt-3 cursor-pointer text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
          Filtrlarni tozalash
        </button>
      )}
    </div>
  );
}
