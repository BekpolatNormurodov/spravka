// Formatting for the Cyrillic "qarzdorlik yo'qligi" maʼlumotnoma. The document itself is
// rendered by CertificateDocument; these are the pieces it cannot express as markup.

/** One contract the maʼlumotnoma covers, as the document prints it. */
export interface DocContract {
  number: string;
  date: Date;
}

/** Date as "DD.MM.YYYY" using UTC (date-only values are stored at UTC midnight). */
export function dmy(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

/** Uzbek-Cyrillic month names, as used in the source .docx ("июнь"). */
export const UZ_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
] as const;

/** Long date exactly as the .docx writes it: "2026 йил 26 июнь". */
export function uzLongDate(date: Date): string {
  return `${date.getUTCFullYear()} йил ${date.getUTCDate()} ${UZ_MONTHS[date.getUTCMonth()]}`;
}

/** Group a numeric amount string with spaces: "4000000" -> "4 000 000". */
export function formatSum(amount: string): string {
  const n = String(amount).replace(/[^\d]/g, '');
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * '«Микроқарз» универсал шартномаси' → '«Микроқарз» универсал шартномалари'.
 *
 * Every blank opens in the plural («…шартномаларига асосан умумий») and closes in the
 * singular («…шартномасига асосан қарздорлиги»), and does so whether it lists one contract
 * or two — the form is fixed by the template, not by the count.
 *
 * 'Shartnoma turi' is a free-text field, so a value that does not end in the -си possessive
 * is returned untouched rather than guessed at.
 */
export function contractTypePlural(contractType: string): string {
  return contractType.replace(/си$/, 'лари');
}
