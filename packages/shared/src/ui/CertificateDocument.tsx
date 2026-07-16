import React from 'react';
import { dmy, uzLongDate, formatSum } from '../core/document';

export interface CertFirm {
  name: string;
  shortName?: string | null;
  directorName: string;
  directorPosition: string;
  executorName: string;
  executorPhone?: string | null;
  phone: string;
  address?: string | null;
  stir?: string | null;
  bankAccount?: string | null;
  mfo?: string | null;
  bankName?: string | null;
}

/**
 * The firm to print. Once signed, `firmSnapshot` is the legal record — prefer it over the
 * live Firm row so later edits never alter an issued document.
 */
export function firmForDocument(firm: CertFirm, firmSnapshot: unknown): CertFirm {
  return (firmSnapshot as CertFirm | null) ?? firm;
}

export interface CertificateDocumentProps {
  number: string;
  issueDate: Date;
  personFullName: string;
  personPassport: string;
  passportIssuedBy?: string | null;
  passportIssuedAt?: Date | null;
  contractNumber: string;
  contractDate: Date;
  contractType: string;
  loanAmount: string;
  asOfDate: Date;
  firm: CertFirm;
  /** Renders the green «ТАСДИҚЛАНДИ» stamp. */
  signed?: boolean;
  /** Optional QR data-URL (our addition — printed in the bottom corner). */
  qrDataUrl?: string;
}

/**
 * 1:1 replica of the source .docx "Қарздорлиги йўқлиги тўғрисида маълумотнома".
 *
 * Fidelity notes (measured from the .docx):
 *   page A4 11906×16838 twips; margins top/bottom 1134 (2cm), right 851 (1.5cm), left 1701 (3cm)
 *   font Times New Roman; body 14pt (sz 28); Сана/№ + letterhead 12pt (sz 24); Ижрочи/Тел 10pt (sz 20)
 *   body paragraphs justified with firstLine indent 708 twips (1.25cm)
 *   bold runs: firm name, person full name, "<contract>-сонли"
 */
export function CertificateDocument(p: CertificateDocumentProps) {
  const { firm } = p;

  const addressLine = [
    firm.address,
    firm.stir && `ИНН ${firm.stir}.`,
    firm.bankAccount && `Х/р ${firm.bankAccount}.`,
    firm.mfo && `МФО ${firm.mfo}.`,
  ]
    .filter(Boolean)
    .join(' ');

  const bankLine = [firm.bankName, firm.phone && `Тел: ${firm.phone}`].filter(Boolean).join(' ');

  const passportInfo =
    p.passportIssuedAt && p.passportIssuedBy
      ? `(шахс гувохномаси: ${p.personPassport}, ${dmy(p.passportIssuedAt)} йилда ${p.passportIssuedBy} томонидан берилган)`
      : `(шахс гувохномаси: ${p.personPassport})`;

  return (
    <div className="cert-sheet" style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>
      {/* ── Letterhead (word/header1.xml) ─────────────────────────────── */}
      <header style={{ textAlign: 'center', lineHeight: 1.25 }}>
        <div style={{ fontSize: '12pt', fontWeight: 700 }}>{firm.name}</div>
        {addressLine && <div style={{ fontSize: '12pt' }}>{addressLine}</div>}
        {bankLine && <div style={{ fontSize: '12pt' }}>{bankLine}</div>}
        <div style={{ borderBottom: '1.5pt solid #000', marginTop: '4pt' }} />
      </header>

      {/* ── Сана / № (top-left, bold 12pt) ───────────────────────────── */}
      <div style={{ fontSize: '12pt', fontWeight: 700, marginTop: '14pt', lineHeight: 1.35 }}>
        <div>Сана: {dmy(p.issueDate)} й</div>
        <div>№ {p.number}</div>
      </div>

      {/* ── Addressee (right, bold 14pt) ─────────────────────────────── */}
      <div style={{ fontSize: '14pt', fontWeight: 700, textAlign: 'right', marginTop: '18pt' }}>
        {p.personFullName}га
      </div>

      {/* ── Title (center, bold 14pt) ────────────────────────────────── */}
      <h1 style={{ fontSize: '14pt', fontWeight: 700, textAlign: 'center', margin: '14pt 0 12pt' }}>
        МАЪЛУМОТНОМА
      </h1>

      {/* ── Body (justified, first-line indent 1.25cm, 14pt) ─────────── */}
      <p style={{ fontSize: '14pt', textAlign: 'justify', textIndent: '1.25cm', margin: 0, lineHeight: 1.45 }}>
        <b>{firm.name}</b> билан <b>{p.personFullName}</b> {passportInfo} ўртасида имзоланган{' '}
        {dmy(p.contractDate)} йилдаги <b>{p.contractNumber}-сонли</b> {p.contractType}га асосан умумий{' '}
        {formatSum(p.loanAmount)} сўм миқдорида кредитлар ажратилган.
      </p>
      <p style={{ fontSize: '14pt', textAlign: 'justify', textIndent: '1.25cm', margin: 0, lineHeight: 1.45 }}>
        <b>{p.personFullName}</b>нинг {uzLongDate(p.asOfDate)} ҳолатида, <b>{p.contractNumber}-сонли</b>{' '}
        {p.contractType}га асосан қарздорлиги тўлиқ қопланган ва ташкилот олдида қарздорлиги мавжуд
        эмаслигини маълум қиламиз.
      </p>

      {/* ── Signature block ──────────────────────────────────────────── */}
      <div style={{ position: 'relative', marginTop: '30pt' }}>
        <div style={{ fontSize: '14pt', fontWeight: 700, maxWidth: '58mm', lineHeight: 1.3 }}>{firm.name}</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: '14pt',
            fontWeight: 700,
            marginTop: '2pt',
          }}
        >
          <span>{firm.directorPosition}</span>
          <span>{firm.directorName}</span>
        </div>

        {p.signed && (
          <div
            aria-label="Тасдиқланди"
            style={{
              position: 'absolute',
              right: '8mm',
              top: '-6mm',
              transform: 'rotate(-12deg)',
              border: '3px solid #059669',
              borderRadius: '6px',
              padding: '4px 10px',
              color: '#059669',
              fontFamily: '"Plus Jakarta Sans", sans-serif',
              fontWeight: 800,
              letterSpacing: '2px',
              fontSize: '12pt',
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          >
            ТАСДИҚЛАНДИ
          </div>
        )}
      </div>

      {/* ── Executor (10pt) ──────────────────────────────────────────── */}
      <div style={{ marginTop: '26pt', fontSize: '10pt', lineHeight: 1.35 }}>
        <div>Ижрочи: {firm.executorName}</div>
        <div>Тел: {firm.executorPhone ?? firm.phone}</div>
      </div>

      {/* ── QR (our addition, not in the .docx) ──────────────────────── */}
      {p.qrDataUrl && (
        <div style={{ marginTop: '10pt', display: 'flex', justifyContent: 'flex-end' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.qrDataUrl} alt="QR" style={{ width: '22mm', height: '22mm' }} />
        </div>
      )}
    </div>
  );
}
