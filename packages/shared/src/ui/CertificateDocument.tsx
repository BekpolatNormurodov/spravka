import React from 'react';
import { dmy, uzLongDate, formatSum, contractTypePlural, type DocContract } from '../core/document';

/**
 * «14.05.2026 йилдаги **8130-сонли**, 26.05.2026 йилдаги **28324-сонли**» — the blanks list
 * every contract inline, comma-separated, with only the number bold.
 */
function ContractList({ contracts }: { contracts: DocContract[] }) {
  return (
    <>
      {contracts.map((c, i) => (
        <React.Fragment key={`${c.number}-${i}`}>
          {i > 0 && ', '}
          {dmy(c.date)} йилдаги <b>{c.number}-сонли</b>
        </React.Fragment>
      ))}
    </>
  );
}

export interface CertFirm {
  /** Body-text form of the name (the source docs end it 'МЧЖ'). */
  name: string;
  /**
   * Letterhead + signature form. The firms write these two differently (their letterheads
   * end 'MCHJ' while the body says 'МЧЖ'), so it is stored, not derived. Falls back to `name`.
   */
  letterheadName?: string | null;
  /** Latin name/address for the ariza; the maʼlumotnoma ignores them. Fall back to the Cyrillic forms. */
  arizaName?: string | null;
  arizaAddress?: string | null;
  shortName?: string | null;
  directorName: string;
  directorPosition: string;
  executorName?: string | null;
  executorPhone?: string | null;
  phone?: string | null;
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

/*
  There was a rotated «ТАСДИҚЛАНДИ» / «ТАСДИҚЛАНМАГАН» badge over the signature block. It was ours,
  not the blank's, and it was removed on request: the source .docx carries no such mark, so it was
  the one thing on the page that told a reader this document came out of a web app.

  Nothing is lost by dropping it. Only a SIGNED certificate is ever served publicly, the public page
  says so above the paper in its own words, and the QR is what actually answers «is this real».
*/

/**
 * Turns the document's variable slots into editors, in place.
 *
 * Render props rather than imports, deliberately: `@spravka/shared/pdf` renders this same
 * component under Node and hands the markup to Chromium. If the editors were imported here, a
 * browser-only bundle would follow the document into the PDF path.
 *
 * The template sentences are not in this interface and never will be — a maʼlumotnoma is a 1:1
 * replica of the source .docx, and there is no reviewer between the yurist and the printed paper.
 */
export interface CertificateEdit {
  /** A long value that wraps inside a paragraph. */
  text: (
    field: 'personFullName' | 'passportIssuedBy' | 'contractType' | 'asOfText' | 'infoRecipient',
  ) => React.ReactNode;
  /** A short masked value: passport, a date, a sum. */
  value: (field: 'personPassport' | 'passportIssuedAt' | 'loanAmount' | 'issueDate') => React.ReactNode;
  /** The whole contract list, add and remove included. */
  contracts: () => React.ReactNode;
}

export interface CertificateDocumentProps {
  number: string;
  issueDate: Date;
  personFullName: string;
  personPassport: string;
  passportIssuedBy?: string | null;
  passportIssuedAt?: Date | null;
  /** At least one; printed inline in order, exactly as the blanks list them. */
  contracts: DocContract[];
  contractType: string;
  loanAmount: string;
  asOfDate: Date;
  /**
   * The «... ҳолатида» phrase as it was written. Falls back to `asOfDate` rendered long-form, so
   * every document issued before this field existed reads exactly as it always did.
   */
  asOfText?: string | null;
  /**
   * The «Маълумот учун:» addressee, written with its own case ending — nothing is appended to it.
   *
   * Three states, and they are not the same: absent/null is a document with no such line, `''` is
   * one that has the line but has not been written yet (only reachable while editing), and text
   * prints. Most maʼlumotnoma have no second addressee, so null is the ordinary case.
   */
  infoRecipient?: string | null;
  firm: CertFirm;
  /** Optional QR data-URL (our addition — printed in the bottom corner). */
  qrDataUrl?: string;
  /**
   * Present only while an ariza is being written. Absent — which is the case for the PDF, the
   * public page and every signed document — this component renders exactly as it always has.
   */
  edit?: CertificateEdit;
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
  const { firm, edit } = p;
  const blankName = firm.letterheadName || firm.name;

  /** A slot: an editor while writing, the printed value otherwise. */
  const name = edit ? edit.text('personFullName') : p.personFullName;
  const contractList = edit ? edit.contracts() : <ContractList contracts={p.contracts} />;

  const addressLine = [
    firm.address,
    firm.stir && `ИНН ${firm.stir}.`,
    firm.bankAccount && `Х/р ${firm.bankAccount}.`,
    firm.mfo && `МФО ${firm.mfo}.`,
  ]
    .filter(Boolean)
    .join(' ');

  const bankLine = [firm.bankName, firm.phone && `Тел: ${firm.phone}`].filter(Boolean).join(' ');

  const executorPhone = firm.executorPhone ?? firm.phone;
  const hasExecutor = !!(firm.executorName || executorPhone);

  /*
    The clause drops the issuing details when the firm did not record them. While writing it is
    always shown in full, or the two optional slots would have nowhere to be typed — the one place
    the editing view and the printed page differ on purpose. The «Chop etish koʻrinishi» toggle
    turns editing off and shows exactly what will print.
  */
  const withIssuer = edit ? true : !!(p.passportIssuedAt && p.passportIssuedBy);

  /*
    The «Маълумот учун:» line, on the page only when the document has one.

    While editing, having the line is the yurist's own choice — they switch it on and it appears
    empty, waiting to be typed. On paper an empty one would print a label pointing at nobody, so
    only a written value shows.
  */
  const withInfoFor = edit ? p.infoRecipient != null : !!p.infoRecipient?.trim();

  const passportInfo = (
    <>
      (шахс гувохномаси: {edit ? edit.value('personPassport') : p.personPassport}
      {withIssuer && (
        <>
          , {edit ? edit.value('passportIssuedAt') : dmy(p.passportIssuedAt!)} йилда{' '}
          {edit ? edit.text('passportIssuedBy') : p.passportIssuedBy} томонидан берилган
        </>
      )}
      )
    </>
  );

  return (
    <div className="cert-sheet" style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>
      {/* ── Letterhead (word/header1.xml) — no rule under it in any source doc ── */}
      <header style={{ textAlign: 'center', lineHeight: 1.25 }}>
        <div style={{ fontSize: '12pt', fontWeight: 700 }}>{blankName}</div>
        {addressLine && <div style={{ fontSize: '12pt' }}>{addressLine}</div>}
        {bankLine && <div style={{ fontSize: '12pt' }}>{bankLine}</div>}
      </header>

      {/*
        ── Сана/№ | addressee ────────────────────────────────────────────
        A borderless 2-column table, exactly as the .docx has it:
        w:tblW 9374 dxa split 5226 / 4148 → 55.75% / 44.25%, all w:tblBorders "none".
        Left cell 12pt bold, right cell 14pt bold.

        Corrected 2026-07-19 against a screenshot of the source document, which shows
        'Сана: 26.06.2026 й', '№ 26062026/04' and '…ҚИЗИга'. This comment previously asserted the
        opposite of all three — no trailing 'й', no space after №, an uppercase 'ГА' — and there is
        no .docx in the repo to check either claim against. The blank is the authority; if a future
        reading of it disagrees, re-measure rather than trusting either version of this note.
      */}
      <table
        style={{ width: '100%', borderCollapse: 'collapse', marginTop: '14pt', tableLayout: 'fixed' }}
      >
        <tbody>
          <tr>
            <td style={{ width: '55.75%', verticalAlign: 'top', padding: 0, border: 0 }}>
              <div style={{ fontSize: '12pt', fontWeight: 700, lineHeight: 1.35 }}>
                <div>Сана: {edit ? edit.value('issueDate') : dmy(p.issueDate)} й</div>
                {/* The counter issues the number when the ariza is saved, so one being written has
                    none and the row simply is not there yet. Nothing stands in for it: a mark in
                    the place of a certificate number is a mark that is not a certificate number. */}
                {p.number && <div>№ {p.number}</div>}
              </div>
            </td>
            <td style={{ width: '44.25%', verticalAlign: 'top', padding: 0, border: 0 }}>
              <div style={{ fontSize: '14pt', fontWeight: 700, lineHeight: 1.3 }}>
                {name}га
              </div>
            </td>
          </tr>

          {/*
            A second addressee, in the same two columns so it lines up with the first.

            Both cells sit on the top of the row, so «Маълумот учун:» stands beside the *first* line of
            the organisation («KAPITAL SUGʻURTA»), not its last — the label reads as the opening of the
            block rather than trailing under it. The label is 12pt regular: a note about who else is
            receiving this, not part of the address.
          */}
          {withInfoFor && (
            <tr>
              {/* 18pt is one blank 14pt line at this line-height — the gap the blank leaves between
                  the two addressees, rather than an arbitrary margin that happens to look close. */}
              <td style={{ verticalAlign: 'top', padding: '18pt 4mm 0 0', border: 0, textAlign: 'right' }}>
                <div style={{ fontSize: '12pt', lineHeight: 1.3 }}>Маълумот учун:</div>
              </td>
              <td style={{ verticalAlign: 'top', padding: '18pt 0 0', border: 0 }}>
                <div style={{ fontSize: '14pt', fontWeight: 700, lineHeight: 1.3 }}>
                  {edit ? edit.text('infoRecipient') : p.infoRecipient}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Title (center, bold 14pt) ────────────────────────────────── */}
      <h1 style={{ fontSize: '14pt', fontWeight: 700, textAlign: 'center', margin: '14pt 0 12pt' }}>
        МАЪЛУМОТНОМА
      </h1>

      {/*
        ── Body (justified, first-line indent 1.25cm, 14pt) ─────────────
        The blanks put the contract type in the plural here and the singular below, however
        many contracts they list — so the two paragraphs differ on purpose.

        Which is why only the singular one below is editable: both print one stored value, and two
        editors over it would each undo the other. The plural here follows whatever is typed there.
      */}
      <p style={{ fontSize: '14pt', textAlign: 'justify', textIndent: '1.25cm', margin: 0, lineHeight: 1.45 }}>
        <b>{firm.name}</b> билан <b>{name}</b> {passportInfo} ўртасида имзоланган{' '}
        {contractList} {contractTypePlural(p.contractType)}га асосан умумий{' '}
        {edit ? edit.value('loanAmount') : formatSum(p.loanAmount)} сўм миқдорида кредитлар ажратилган.
      </p>
      <p style={{ fontSize: '14pt', textAlign: 'justify', textIndent: '1.25cm', margin: 0, lineHeight: 1.45 }}>
        <b>{name}</b>нинг {edit ? edit.text('asOfText') : (p.asOfText || uzLongDate(p.asOfDate))} ҳолатида{' '}
        {contractList} {edit ? edit.text('contractType') : p.contractType}га асосан қарздорлиги тўлиқ
        қопланган ва ташкилот олдида қарздорлиги мавжуд эмаслигини маълум қиламиз.
      </p>

      {/*
        ── Signature block ────────────────────────────────────────────
        The QR is the verification «seal» — centred in the open space of the signature, where a round
        stamp (М.П.) is pressed: the firm name to its left, the director's signature on the line below.
        Absolutely placed so it never disturbs the firm name or the signature line around it.
      */}
      <div style={{ marginTop: '30pt', position: 'relative', minHeight: '26mm' }}>
        <div style={{ fontSize: '14pt', fontWeight: 700, maxWidth: '60mm', lineHeight: 1.3 }}>{blankName}</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            fontSize: '14pt',
            fontWeight: 700,
            marginTop: '12pt',
          }}
        >
          <span>{firm.directorPosition}</span>
          <span>{firm.directorName}</span>
        </div>

        {p.qrDataUrl && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: '58%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.qrDataUrl}
              alt={`${p.number}-сонли маълумотномани текшириш учун QR код`}
              style={{ width: '25mm', height: '25mm', display: 'block' }}
            />
            <div style={{ fontSize: '7pt', color: '#475569', lineHeight: 1.25, marginTop: '1.5mm', whiteSpace: 'nowrap' }}>
              Ҳақиқийлигини текширинг
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: Ижрочи keeps its .docx position (bottom-left, 10pt). ── */}
      {hasExecutor && (
        <div style={{ marginTop: '26pt', fontSize: '10pt', lineHeight: 1.35 }}>
          {firm.executorName && <div>Ижрочи: {firm.executorName}</div>}
          {executorPhone && <div>Тел: {executorPhone}</div>}
        </div>
      )}
    </div>
  );
}
