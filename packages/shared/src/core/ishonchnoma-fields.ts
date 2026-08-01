import type { CertField } from './labels';

/**
 * The fields an «Ишончнома» (power of attorney) must carry — checked with `missingFieldsError` in
 * every route that writes one. The issuing firm supplies the letterhead, bank rekvizitlar and the
 * director's signature; the operator supplies the authorised person, the service contract and the
 * validity date. PINFL and passport both required — the person is named and their passport printed.
 */
export const ISHONCHNOMA_REQUIRED = [
  'firmId', 'personPinfl', 'personFullName', 'personPassport',
  'poaBankName', 'poaContractDate', 'poaContractNumber', 'poaValidUntil', 'issueDate',
] as const satisfies readonly CertField[];

/** The same, minus `firmId` — an edit does not move the ishonchnoma to another firm. */
export const ISHONCHNOMA_EDIT_REQUIRED: readonly CertField[] = ISHONCHNOMA_REQUIRED.filter((f) => f !== 'firmId');

/**
 * The scalar ishonchnoma columns from a request body, normalised for Prisma — blank optionals to
 * null, dates parsed. Shared by the create route and both edit routes. The caller adds
 * id/number/seq/firmId/status/clientId/createdById.
 *
 * `loanAmount`/`asOfDate` are non-null columns the ishonchnoma does not use; it stores 0 and the
 * issue date so the row is valid, and neither is ever printed on this document.
 */
export function ishonchnomaColumns(b: Record<string, unknown>) {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const orNull = (v: unknown) => s(v) || null;

  return {
    personFullName: s(b.personFullName),
    personPinfl: orNull(b.personPinfl),
    personPassport: orNull(b.personPassport),
    poaBankName: orNull(b.poaBankName),
    poaContractNumber: orNull(b.poaContractNumber),
    poaContractDate: s(b.poaContractDate) ? new Date(s(b.poaContractDate)) : null,
    poaValidUntil: s(b.poaValidUntil) ? new Date(s(b.poaValidUntil)) : null,
    issueDate: new Date(s(b.issueDate)),
    // Unused non-null columns — stored, never printed on an ishonchnoma.
    loanAmount: '0',
    asOfDate: new Date(s(b.issueDate)),
  };
}

/** The authorised person's reusable Client fields from an ishonchnoma body. */
export function ishonchnomaClientFields(b: Record<string, unknown>) {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    fullName: s(b.personFullName),
    passport: s(b.personPassport) || null,
  };
}
