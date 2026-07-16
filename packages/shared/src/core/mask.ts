// Input masks. Pure + unit-tested — the UI layer only calls these.

/** Digits only. */
const digits = (v: string) => v.replace(/\D/g, '');

/** "4000000" | "4 000 000" -> "4 000 000" (space-grouped thousands). */
export function maskAmount(v: string): string {
  const n = digits(v).replace(/^0+(?=\d)/, '');
  return n.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** "4 000 000" -> "4000000" (what we send to the API). */
export function unmaskAmount(v: string): string {
  return digits(v);
}

/**
 * Uzbek phone: "+998 XX XXX XX XX". Accepts raw digits with or without the 998 prefix.
 * Partial input stays partial (so typing feels natural).
 */
export function maskPhone(v: string): string {
  let n = digits(v);
  if (n.startsWith('998')) n = n.slice(3);
  n = n.slice(0, 9);
  if (!n) return '';
  const p = [n.slice(0, 2), n.slice(2, 5), n.slice(5, 7), n.slice(7, 9)].filter(Boolean);
  return `+998 ${p.join(' ')}`.trimEnd();
}

/** "+998 90 123 45 67" -> "+998901234567". */
export function unmaskPhone(v: string): string {
  const n = digits(v);
  if (!n) return '';
  return `+${n.startsWith('998') ? n : `998${n}`}`;
}

/** Uzbek ID/passport: 2 uppercase letters + 7 digits, e.g. "AE5348993". */
export function maskPassport(v: string): string {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letters = s.slice(0, 2).replace(/[^A-Z]/g, '');
  const nums = s.slice(letters.length).replace(/\D/g, '').slice(0, 7);
  return letters + nums;
}

/** STIR / INN — 9 digits. */
export function maskStir(v: string): string {
  return digits(v).slice(0, 9);
}

/** Bank account (h/r) — 20 digits, grouped in 4s for readability. */
export function maskAccount(v: string): string {
  const n = digits(v).slice(0, 20);
  return n.replace(/(.{4})(?=.)/g, '$1 ');
}

/** MFO — 5 digits. */
export function maskMfo(v: string): string {
  return digits(v).slice(0, 5);
}
