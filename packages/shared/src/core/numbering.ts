/** Certificate number: DDMMYYYY/NN (NN zero-padded to at least 2 digits). */
export function formatCertNumber(date: Date, seq: number): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}${mm}${yyyy}/${String(seq).padStart(2, '0')}`;
}

/** Counter row id for a firm's yearly sequence. */
export function counterId(firmId: string, year: number): string {
  return `${firmId}:${year}`;
}
