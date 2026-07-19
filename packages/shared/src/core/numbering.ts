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
