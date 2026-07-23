/**
 * Certificate number: DDMMYYYY/NN (NN zero-padded to at least 2 digits).
 *
 * UTC, like `dmy()` in ./document — date-only values are stored at UTC midnight, and the number
 * and the printed date come from the same field, so they must read it the same way. Local time
 * here would print «25062026/01» above «26.06.2026» on the same page wherever the host sits west
 * of Greenwich: correct in Tashkent, wrong the moment the server's TZ is not.
 */
export function formatCertNumber(date: Date, seq: number): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = date.getUTCFullYear();
  return `${dd}${mm}${yyyy}/${String(seq).padStart(2, '0')}`;
}

/** The day a certificate counts against — UTC, for the same reason as {@link formatCertNumber}. */
export function certDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Counter row id for a firm's daily sequence.
 *
 * Daily rather than yearly: NN restarts at 01 each day, so the first maʼlumotnoma of 20 July 2026
 * is «20072026/01» and the second «20072026/02». The date is already in the number, so a per-day
 * sequence stays unique — «20072026/01» and «21072026/01» are different documents.
 */
export function counterId(firmId: string, day: string): string {
  return `${firmId}:${day}`;
}

/* ── «Savdo-sanoat palatasiga ariza» register ──────────────────────────────────────────────────
   The ariza carries its own number, «NNNN/09-02» — a running register with the fixed department
   code «09-02». Unlike the maʼlumotnoma there is no firm or date in it, so the sequence is a single
   per-year counter rather than per-firm-per-day. */

/** Ariza register number: «NNNN/09-02» (4-digit minimum pad; «09-02» is the department code). */
export function formatArizaNumber(seq: number): string {
  return `${String(seq).padStart(4, '0')}/09-02`;
}

/** Counter row id for the ariza register — a per-year running sequence. */
export function arizaCounterId(year: number): string {
  return `ariza:${year}`;
}
