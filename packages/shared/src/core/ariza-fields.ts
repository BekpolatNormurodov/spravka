import { unmaskAmountDecimal } from './document';
import type { CertField } from './labels';

/**
 * The fields a «Savdo-sanoat palatasiga ariza» must carry — checked with `missingFieldsError` in
 * every route that writes one. No passport (the debtor is identified by PINFL); the debt components
 * and jami are all required because the petition prints each of them.
 */
export const ARIZA_REQUIRED = [
  'firmId', 'courtName', 'personPinfl', 'personFullName', 'personAddress', 'personPhone',
  'interestRate', 'loanAmount', 'asOfDate', 'issueDate',
  'debtPrincipal', 'debtTermInterest', 'debtOverduePrincipal', 'debtOverdueInterest', 'debtTotal',
] as const satisfies readonly CertField[];

/** The same, minus `firmId` — an edit does not move the ariza to another firm. */
export const ARIZA_EDIT_REQUIRED: readonly CertField[] = ARIZA_REQUIRED.filter((f) => f !== 'firmId');

/**
 * The scalar ariza columns from a request body, normalised for Prisma — money to dot-decimal, blank
 * optional strings to null, dates parsed. Shared by the create route and both edit routes so the
 * three cannot drift. The caller adds id/number/seq/firmId/status/clientId/contracts/createdById.
 */
export function arizaColumns(b: Record<string, unknown>) {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const orNull = (v: unknown) => s(v) || null;
  const money = (v: unknown) => (s(v) ? unmaskAmountDecimal(s(v)) : null);

  return {
    courtName: orNull(b.courtName),
    interestRate: orNull(b.interestRate),
    personFullName: s(b.personFullName),
    personPinfl: orNull(b.personPinfl),
    personAddress: orNull(b.personAddress),
    personPhone: orNull(b.personPhone),
    contractType: s(b.contractType) || 'ONLAYN',
    // loanAmount is a non-null column; a validated ariza always carries it.
    loanAmount: unmaskAmountDecimal(s(b.loanAmount) || '0'),
    debtPrincipal: money(b.debtPrincipal),
    debtTermInterest: money(b.debtTermInterest),
    debtOverduePrincipal: money(b.debtOverduePrincipal),
    debtOverdueInterest: money(b.debtOverdueInterest),
    debtTotal: money(b.debtTotal),
    asOfDate: new Date(s(b.asOfDate)),
    asOfText: orNull(b.asOfText),
    issueDate: new Date(s(b.issueDate)),
    chamberSignerPosition: orNull(b.chamberSignerPosition),
    chamberSignerName: orNull(b.chamberSignerName),
    chamberExecutorName: orNull(b.chamberExecutorName),
    chamberExecutorPhone: orNull(b.chamberExecutorPhone),
  };
}

/** The debtor's reusable Client fields from an ariza body — no passport, unlike the maʼlumotnoma. */
export function arizaClientFields(b: Record<string, unknown>) {
  const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return {
    fullName: s(b.personFullName),
    address: s(b.personAddress) || null,
    phone: s(b.personPhone) || null,
  };
}
