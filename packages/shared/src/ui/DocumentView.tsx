import React from 'react';
import { CertificateDocument, firmForDocument, type CertFirm } from './CertificateDocument';
import { CourtArizaDocument } from './CourtArizaDocument';

/** Money as Prisma hands it (a Decimal) or already a string. */
type Money = { toString(): string } | string | null;
const s = (v: Money): string => (v == null ? '' : v.toString());

/**
 * The scalar shape both documents read from a Certificate row. A superset — an ariza leaves the
 * maʼlumotnoma-only fields null and vice versa. The Prisma row satisfies this as-is.
 */
export interface DocumentRow {
  docType: string;
  number: string;
  issueDate: Date;
  personFullName: string;
  contracts: { number: string; date: Date }[];
  contractType: string;
  loanAmount: Money;
  asOfDate: Date;
  asOfText: string | null;
  firm: CertFirm;
  firmSnapshot: unknown;
  // maʼlumotnoma
  personPassport?: string | null;
  passportIssuedBy?: string | null;
  passportIssuedAt?: Date | null;
  infoRecipient?: string | null;
  // ariza
  courtName?: string | null;
  personPinfl?: string | null;
  personAddress?: string | null;
  personPhone?: string | null;
  interestRate?: string | null;
  debtPrincipal?: Money;
  debtTermInterest?: Money;
  debtOverduePrincipal?: Money;
  debtOverdueInterest?: Money;
  debtTotal?: Money;
  chamberSignerPosition?: string | null;
  chamberSignerName?: string | null;
  chamberExecutorName?: string | null;
  chamberExecutorPhone?: string | null;
}

/**
 * Renders the right document for a stored row, branched on `docType`. One place the four detail
 * pages and the public page share, so a new document type is wired once, not five times.
 */
export function DocumentView({ cert, qrDataUrl }: { cert: DocumentRow; qrDataUrl?: string }) {
  const firm = firmForDocument(cert.firm, cert.firmSnapshot);

  if (cert.docType === 'ARIZA') {
    return (
      <CourtArizaDocument
        number={cert.number}
        issueDate={cert.issueDate}
        courtName={cert.courtName ?? ''}
        personFullName={cert.personFullName}
        personPinfl={cert.personPinfl ?? ''}
        personAddress={cert.personAddress ?? ''}
        personPhone={cert.personPhone ?? ''}
        contracts={cert.contracts}
        contractType={cert.contractType}
        interestRate={cert.interestRate ?? ''}
        loanAmount={s(cert.loanAmount)}
        asOfDate={cert.asOfDate}
        asOfText={cert.asOfText}
        debtPrincipal={s(cert.debtPrincipal ?? null)}
        debtTermInterest={s(cert.debtTermInterest ?? null)}
        debtOverduePrincipal={s(cert.debtOverduePrincipal ?? null)}
        debtOverdueInterest={s(cert.debtOverdueInterest ?? null)}
        debtTotal={s(cert.debtTotal ?? null)}
        chamberSignerPosition={cert.chamberSignerPosition ?? ''}
        chamberSignerName={cert.chamberSignerName ?? ''}
        chamberExecutorName={cert.chamberExecutorName ?? ''}
        chamberExecutorPhone={cert.chamberExecutorPhone ?? ''}
        firm={firm}
        qrDataUrl={qrDataUrl}
      />
    );
  }

  return (
    <CertificateDocument
      number={cert.number}
      issueDate={cert.issueDate}
      personFullName={cert.personFullName}
      personPassport={cert.personPassport ?? ''}
      passportIssuedBy={cert.passportIssuedBy}
      passportIssuedAt={cert.passportIssuedAt}
      contracts={cert.contracts}
      contractType={cert.contractType}
      loanAmount={s(cert.loanAmount)}
      asOfDate={cert.asOfDate}
      asOfText={cert.asOfText}
      infoRecipient={cert.infoRecipient}
      firm={firm}
      qrDataUrl={qrDataUrl}
    />
  );
}
