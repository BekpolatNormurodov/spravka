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

/** The year a certificate counts against — UTC, for the same reason as {@link formatCertNumber}. */
export function certYear(date: Date): number {
  return date.getUTCFullYear();
}

/** Counter row id for a firm's yearly sequence. */
export function counterId(firmId: string, year: number): string {
  return `${firmId}:${year}`;
}
