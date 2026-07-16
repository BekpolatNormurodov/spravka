/**
 * One place where a firm request body becomes Prisma data, so create and edit can never
 * drift apart — an earlier POST silently dropped the bank rekvizitlar the form collects.
 */

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const orNull = (v: unknown) => str(v) || null;

/** Accepts 'А.А.Бойназаров' (initials+surname, the official Uzbek form) and 'Ism Familiya'. */
export const isDirectorName = (v: string) => v.split(/[.\s]+/).filter(Boolean).length >= 2;

export type FirmBody = ReturnType<typeof firmData>;

export function firmData(b: Record<string, unknown>) {
  return {
    name: str(b.name),
    letterheadName: orNull(b.letterheadName),
    shortName: orNull(b.shortName),
    stir: orNull(b.stir),
    directorName: str(b.directorName),
    directorFullName: orNull(b.directorFullName),
    directorPosition: str(b.directorPosition) || 'Ижрочи директори',
    accountantName: orNull(b.accountantName),
    executorName: orNull(b.executorName),
    executorPhone: orNull(b.executorPhone),
    phone: orNull(b.phone),
    bankName: orNull(b.bankName),
    bankAccount: str(b.bankAccount).replace(/\s/g, '') || null,
    mfo: orNull(b.mfo),
    region: orNull(b.region),
    address: orNull(b.address),
  };
}

/** Returns the first problem, or null when the body is good. */
export function firmError(d: FirmBody): string | null {
  if (!d.name) return 'Tashkilot nomini yozing';
  if (!d.directorName) return 'Ijrochi direktor majburiy — har bir firmada bittadan boʻladi';
  if (!isDirectorName(d.directorName)) return 'Direktorning ism va familiyasini toʻliq yozing';
  return null;
}
