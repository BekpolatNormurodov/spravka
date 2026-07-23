import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRequire } from 'node:module';
import { CourtArizaDocument, type CourtArizaDocumentProps } from './CourtArizaDocument';
import { asDate } from './DocumentEdit';
import {
  arizaEditSlots, arizaDraftProblems, arizaWithComputedTotal, arizaPreviewContracts,
  type ArizaDraft,
} from './ArizaEdit';

const renderToStaticMarkup: (el: React.ReactElement) => string =
  createRequire(import.meta.url)('react-dom/server').renderToStaticMarkup;

const FIRM = {
  name: '«BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI» МЧЖ',
  letterheadName: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” MMT MCHJ',
  directorName: 'A.A.', directorPosition: 'Direktor',
  address: 'Toshkent shahar, Olmazor tumani', stir: '311 976 765',
  bankAccount: '20216000207212842001', mfo: '01183',
};

const full: ArizaDraft = {
  courtName: 'Fuqarolik ishlari boʻyicha Uchtepa tumanlararo sudiga',
  personFullName: 'Abdiyeva Muazzamxon Muxsin qizi', personPinfl: '61011006920020',
  personAddress: 'Fargʻona viloyati, Buvayda tumani', personPhone: '998952962728',
  contracts: [{ number: '22548', date: '2026-04-14' }],
  contractType: 'ONLAYN', interestRate: '54', loanAmount: '24900000',
  asOfDate: '2026-07-15', asOfText: '2026 yil 15 iyul',
  debtPrincipal: '24318882.63', debtTermInterest: '143914.49',
  debtOverduePrincipal: '577575.43', debtOverdueInterest: '2224630.19', debtTotal: '27265002.74',
  chamberSignerPosition: 'Boshqarma boshligʻi oʻrinbosari', chamberSignerName: 'B.Babamuradov',
  chamberExecutorName: 'B.Fayziyev', chamberExecutorPhone: '+99895-144-24-00',
  issueDate: '2026-07-15',
};

function docProps(d: ArizaDraft): CourtArizaDocumentProps {
  return {
    number: '0001/09-02', issueDate: asDate(d.issueDate),
    courtName: d.courtName, personFullName: d.personFullName, personPinfl: d.personPinfl,
    personAddress: d.personAddress, personPhone: d.personPhone,
    contracts: arizaPreviewContracts(d),
    contractType: d.contractType, interestRate: d.interestRate, loanAmount: d.loanAmount,
    asOfDate: asDate(d.asOfDate), asOfText: d.asOfText,
    debtPrincipal: d.debtPrincipal, debtTermInterest: d.debtTermInterest,
    debtOverduePrincipal: d.debtOverduePrincipal, debtOverdueInterest: d.debtOverdueInterest,
    debtTotal: d.debtTotal,
    chamberSignerPosition: d.chamberSignerPosition, chamberSignerName: d.chamberSignerName,
    chamberExecutorName: d.chamberExecutorName, chamberExecutorPhone: d.chamberExecutorPhone,
    firm: FIRM,
  };
}

const noop = () => {};
const slots = (d: ArizaDraft) =>
  arizaEditSlots(d, { patch: noop, undo: noop, redo: noop, invalid: () => false });

const words = (m: string) => m.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

describe('editing and printing agree', () => {
  it('the editing view prints the same values as the document', () => {
    const printed = words(renderToStaticMarkup(React.createElement(CourtArizaDocument, docProps(full))));
    const editing = words(renderToStaticMarkup(
      React.createElement(CourtArizaDocument, { ...docProps(full), edit: slots(full) }),
    ));
    for (const value of [
      'Abdiyeva Muazzamxon Muxsin qizi', 'Uchtepa tumanlararo sudiga',
      '24 318 882,63', '27 265 002,74', '14.04.2026-yildagi 22548-sonli',
    ]) {
      expect(printed).toContain(value);
      expect(editing).toContain(value);
    }
  });
});

describe('arizaDraftProblems', () => {
  it('a full draft has no problems', () => {
    expect(arizaDraftProblems(full)).toEqual([]);
  });

  it('flags each missing field once', () => {
    const probs = arizaDraftProblems({
      ...full, courtName: '', personFullName: '', debtPrincipal: '', debtTotal: '',
    });
    const fields = probs.map((p) => p.field);
    expect(fields).toEqual(expect.arrayContaining(['courtName', 'personFullName', 'debtPrincipal', 'debtTotal']));
    // Each field named at most once.
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('does not require a passport', () => {
    expect(arizaDraftProblems(full).some((p) => p.field === 'personPassport')).toBe(false);
  });

  it('rejects an unreadable holat sanasi', () => {
    const probs = arizaDraftProblems({ ...full, asOfText: '15 iyul' });
    expect(probs.some((p) => p.field === 'asOfText')).toBe(true);
  });
});

describe('arizaWithComputedTotal', () => {
  it('sums the four components', () => {
    const d = arizaWithComputedTotal({ ...full, debtTotal: '' });
    expect(d.debtTotal).toBe('27265002.74');
  });

  it('leaves the total alone when nothing is entered', () => {
    const blank = { ...full, debtPrincipal: '', debtTermInterest: '', debtOverduePrincipal: '', debtOverdueInterest: '', debtTotal: '' };
    expect(arizaWithComputedTotal(blank).debtTotal).toBe('');
  });
});
