import React from 'react';
import { dmy } from '../core/document';
import type { CertFirm } from './CertificateDocument';

/**
 * The authority the power of attorney grants — the standard collector mandate, kept verbatim from the
 * source blank. Constant: it does not vary between ишончнома of this kind.
 */
const AUTHORITY =
  'ташкилот номидан Бош прокуратура ҳузуридаги Мажбурий ижро бюроси, унинг ҳудудий бошқармалари ва ' +
  'туман бўлимларида, ИИВ ва унинг ҳудудий бўлинмаларида ташкилот вакили сифатида иштирок этишга, ' +
  'хужжатлар билан танишишга, ариза шикоятлар топширишига ва қарздорларнинг яшаш манзиллари бўйича ' +
  'бориб ундирув ишларини амалга оширишига, қарздорларга талабномалар топширишига, МИБ ходимлари билан ' +
  'биргаликда қарздорларнинг мол-мулкини хатлаш жараёнларида ташкилот вакили сифатида қатнашишига';

export interface PowerOfAttorneyEdit {
  text: (field: 'personFullName' | 'personPassport' | 'poaBankName' | 'poaContractNumber') => React.ReactNode;
  value: (field: 'issueDate' | 'poaContractDate' | 'poaValidUntil') => React.ReactNode;
}

export interface PowerOfAttorneyDocumentProps {
  number: string;
  issueDate: Date;
  /** The authorised person (ишонч билдирилувчи). */
  personFullName: string;
  personPinfl: string;
  personPassport: string;
  /** The bank whose debts are collected, e.g. «ANORBANK». */
  poaBankName: string;
  /** The service contract the authority rests on. */
  poaContractDate: Date | null;
  poaContractNumber: string;
  /** The day the power of attorney expires. */
  poaValidUntil: Date | null;
  /** The issuing firm — its letterhead, rekvizitlar and director's signature. */
  firm: CertFirm;
  qrDataUrl?: string;
  edit?: PowerOfAttorneyEdit;
}

/**
 * 1:1 replica of «Prof Collector.docx» — an ишончнома (power of attorney) a firm issues to authorise
 * a person to collect debts on its behalf. Cyrillic body with Latin firm/person names, Times New
 * Roman, one A4 page. The firm supplies the masthead and signature; the operator fills the person,
 * the service contract and the validity date.
 */
export function PowerOfAttorneyDocument(p: PowerOfAttorneyDocumentProps) {
  const { firm, edit } = p;
  // The masthead carries the full legal name (letterhead form); the body and signature use the
  // short body form — «"Prof Collector" МЧЖ» — exactly as the blank does.
  const headerName = firm.letterheadName || firm.name;
  const bodyName = firm.name;

  const para: React.CSSProperties = {
    fontSize: '14pt', textAlign: 'justify', textIndent: '1.25cm', margin: '0 0 6pt', lineHeight: 1.5,
  };
  const date = (field: Parameters<PowerOfAttorneyEdit['value']>[0], d: Date | null) =>
    (edit ? edit.value(field) : (d ? dmy(d) : ''));

  const bankLine = [
    firm.bankAccount && `р/с ${firm.bankAccount};`,
    firm.stir && `ИНН: ${firm.stir};`,
    firm.mfo && `МФО: ${firm.mfo}`,
    firm.bankName,
  ].filter(Boolean).join(' ');

  return (
    <div className="cert-sheet" style={{ fontFamily: '"Times New Roman", Times, serif', color: '#000' }}>
      {/* ── Masthead: the issuing firm's letterhead ── */}
      <header style={{ textAlign: 'center', lineHeight: 1.2 }}>
        <div style={{ fontSize: '20pt', fontWeight: 700 }}>{headerName}</div>
        {firm.address && <div style={{ fontSize: '10pt', marginTop: '4pt' }}>{firm.address}</div>}
        {bankLine && <div style={{ fontSize: '10pt' }}>{bankLine}</div>}
      </header>

      {/* ── Date / city ── */}
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          fontSize: '12pt', fontWeight: 700, marginTop: '18pt',
        }}
      >
        <span>{edit ? edit.value('issueDate') : dmy(p.issueDate)} йил</span>
        <span>Тошкент шаҳри</span>
      </div>

      {/* ── Title ── */}
      <h1 style={{ fontSize: '14pt', fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em', margin: '16pt 0 14pt' }}>
        И Ш О Н Ч Н О М А № {p.number}
      </h1>

      {/* ── Body ── */}
      <p style={para}>
        “{edit ? edit.text('poaBankName') : p.poaBankName}” АЖ ва <b>{bodyName}</b> ўртасида хизмат
        кўрсатиш бўйича {date('poaContractDate', p.poaContractDate)} йилда тузилган{' '}
        {edit ? edit.text('poaContractNumber') : p.poaContractNumber}-сонли шартномасига асосан{' '}
        “{edit ? edit.text('poaBankName') : p.poaBankName}” АЖ томонидан ажратилган кредитлар бўйича
        қарздорликларни ундириш белгиланган.
      </p>
      <p style={para}>
        Шу муносабат билан, <b>{bodyName}</b>нинг Уставига мувофиқ мазкур ишончнома билан{' '}
        <b>{edit ? edit.text('personFullName') : p.personFullName}</b> (паспорт{' '}
        {edit ? edit.text('personPassport') : p.personPassport})га {AUTHORITY} ишонч билдиради.
      </p>
      <p style={para}>
        Мазкур ишончномадан келиб чиқувчи ваколатлар ишонч билдирилувчи томонидан ўзга шахсларга
        берилиши таъқиқланади.
      </p>
      <p style={para}>
        Ишончнома {date('poaValidUntil', p.poaValidUntil)} йилга қадар амал қилади.
      </p>

      {/* ── Signature ── */}
      <div style={{ marginTop: '28pt' }}>
        <div style={{ fontSize: '14pt', fontWeight: 700, lineHeight: 1.3 }}>{bodyName}</div>
        <div
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
            fontSize: '14pt', fontWeight: 700, marginTop: '4pt', gap: '8mm',
          }}
        >
          <span>{firm.directorPosition}</span>
          {p.qrDataUrl && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '2.5mm' }}>
              <span style={{ textAlign: 'right', fontSize: '7pt', fontWeight: 400, lineHeight: 1.25, color: '#475569' }}>
                Ҳақиқийлигини<br />текшириш
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.qrDataUrl} alt={`${p.number} ишончномани текшириш учун QR код`} style={{ width: '22mm', height: '22mm', display: 'block' }} />
            </span>
          )}
          <span>{firm.directorName}</span>
        </div>
      </div>
    </div>
  );
}
