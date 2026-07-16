/**
 * One place where a request body's contract rows become storable rows, so the yurist's create
 * and the admin's edit can never drift apart — the firm routes already learned that lesson.
 */

export interface ParsedContract {
  number: string;
  date: Date;
  /** Print order in the document. */
  order: number;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/**
 * Returns the normalised rows, or the first problem. A row left entirely blank is dropped —
 * the form lets a user add a row and change their mind — but a half-filled one is an error
 * rather than a document issued with a contract that has no date.
 */
export function parseContracts(raw: unknown): { error: string } | { contracts: ParsedContract[] } {
  const list = Array.isArray(raw) ? raw : [];
  const out: ParsedContract[] = [];

  for (const item of list) {
    const number = str((item as { number?: unknown })?.number);
    const rawDate = str((item as { date?: unknown })?.date);
    if (!number && !rawDate) continue;
    if (!number) return { error: 'Shartnoma raqamini yozing' };
    if (!rawDate) return { error: 'Shartnoma sanasini tanlang' };

    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return { error: `Shartnoma sanasi notoʻgʻri: ${rawDate}` };

    out.push({ number, date, order: out.length });
  }

  if (!out.length) return { error: 'Kamida bitta shartnoma kiriting' };
  return { contracts: out };
}
