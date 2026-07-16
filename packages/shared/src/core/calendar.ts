// Pure month/day helpers for the Kalendar pages. UTC-based: date-only values are
// stored at UTC midnight, so local-time math would shift days.

/** Date -> 'YYYY-MM-DD' (UTC). */
export function isoDay(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Date -> 'YYYY-MM' (UTC). */
export function isoMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Half-open [gte, lt) range covering a 'YYYY-MM'. */
export function monthRange(month: string): { gte: Date; lt: Date } {
  const [y, m] = month.split('-').map(Number);
  return { gte: new Date(Date.UTC(y!, m! - 1, 1)), lt: new Date(Date.UTC(y!, m!, 1)) };
}

/** Shift a 'YYYY-MM' by n months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  return isoMonth(d);
}

/** True when 'YYYY-MM' is well formed. */
export function isValidMonth(month: string | undefined): month is string {
  return !!month && /^\d{4}-\d{2}$/.test(month);
}

/** Group {date,status} rows into the Calendar's per-day shape. */
export function groupByDay(rows: { date: Date; status: string }[]): Record<string, { total: number; counts: Record<string, number> }> {
  const out: Record<string, { total: number; counts: Record<string, number> }> = {};
  for (const r of rows) {
    const k = isoDay(r.date);
    const cell = (out[k] ??= { total: 0, counts: {} });
    cell.total += 1;
    cell.counts[r.status] = (cell.counts[r.status] ?? 0) + 1;
  }
  return out;
}
