// Renders the Cyrillic "qarzdorlik yo'qligi" certificate body text from a certificate's data.
// Shared by the admin preview, the director (rahbar) view, and the public verification page.

export interface CertDocData {
  firmName: string;
  personFullName: string;
  personPassport: string;
  passportIssuedBy?: string | null;
  passportIssuedAt?: Date | null;
  contractNumber: string;
  contractDate: Date;
  contractType: string;
  loanAmount: string; // decimal as string
  asOfDate: Date;
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

export function certificateBody(x: CertDocData): string {
  const passport =
    x.passportIssuedAt && x.passportIssuedBy
      ? `(шахс гувоҳномаси: ${x.personPassport}, ${dmy(x.passportIssuedAt)} йилда ${x.passportIssuedBy} томонидан берилган)`
      : `(шахс гувоҳномаси: ${x.personPassport})`;

  return (
    `“${x.firmName}” билан ${x.personFullName} ${passport} ўртасида имзоланган ` +
    `${dmy(x.contractDate)} йилдаги ${x.contractNumber}-сонли ${x.contractType}га асосан умумий ` +
    `${formatSum(x.loanAmount)} сўм миқдорида кредитлар ажратилган. ${x.personFullName}нинг ` +
    `${dmy(x.asOfDate)} ҳолатига кўра, ${x.contractNumber}-сонли ${x.contractType}га асосан ` +
    `қарздорлиги тўлиқ қопланган ва ташкилот олдида қарздорлиги мавжуд эмаслигини маълум қиламиз.`
  );
}
