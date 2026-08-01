import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRequire } from 'node:module';
import { PowerOfAttorneyDocument, type PowerOfAttorneyDocumentProps } from './PowerOfAttorneyDocument';
import { asDate } from './DocumentEdit';
import { poaEditSlots, poaDraftProblems, type PoaDraft } from './IshonchnomaEdit';

const renderToStaticMarkup: (el: React.ReactElement) => string =
  createRequire(import.meta.url)('react-dom/server').renderToStaticMarkup;

const FIRM = {
  name: '«Prof Collector» МЧЖ',
  letterheadName: '«PROF COLLECTOR» МАСЪУЛИЯТИ ЧЕКЛАНГАН ЖАМИЯТИ',
  directorName: 'Ж.К.Султанов', directorPosition: 'Ижрочи директори',
  address: 'Тошкент шаҳар', stir: '313 090 254', bankAccount: '2020', mfo: '01183', bankName: 'АЖ «ANOR BANK»',
};

const full: PoaDraft = {
  personFullName: 'HOSILOV SHAXBOZ BAXODIR OʻGʻLI', personPinfl: '31234567890123', personPassport: 'AE 1020513',
  poaBankName: 'ANORBANK', poaContractDate: '2026-06-17', poaContractNumber: '1', poaValidUntil: '2026-08-31',
  issueDate: '2026-06-01',
};

function docProps(d: PoaDraft): PowerOfAttorneyDocumentProps {
  return {
    number: '1/2026', issueDate: asDate(d.issueDate),
    personFullName: d.personFullName, personPinfl: d.personPinfl, personPassport: d.personPassport,
    poaBankName: d.poaBankName,
    poaContractDate: d.poaContractDate ? asDate(d.poaContractDate) : null,
    poaContractNumber: d.poaContractNumber,
    poaValidUntil: d.poaValidUntil ? asDate(d.poaValidUntil) : null,
    firm: FIRM,
  };
}

const noop = () => {};
const slots = (d: PoaDraft) => poaEditSlots(d, { patch: noop, undo: noop, redo: noop, invalid: () => false });
const words = (m: string) => m.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

describe('ishonchnoma editing and printing agree', () => {
  it('the editing view prints the same values as the document', () => {
    const printed = words(renderToStaticMarkup(React.createElement(PowerOfAttorneyDocument, docProps(full))));
    const editing = words(renderToStaticMarkup(
      React.createElement(PowerOfAttorneyDocument, { ...docProps(full), edit: slots(full) }),
    ));
    for (const value of ['HOSILOV SHAXBOZ BAXODIR OʻGʻLI', 'AE 1020513', 'ANORBANK', '17.06.2026', '31.08.2026']) {
      expect(printed).toContain(value);
      expect(editing).toContain(value);
    }
  });
});

describe('poaDraftProblems', () => {
  it('a full draft has no problems', () => expect(poaDraftProblems(full)).toEqual([]));

  it('flags each missing field once', () => {
    const probs = poaDraftProblems({ ...full, personFullName: '', poaBankName: '', poaValidUntil: '' });
    const fields = probs.map((p) => p.field);
    expect(fields).toEqual(expect.arrayContaining(['personFullName', 'poaBankName', 'poaValidUntil']));
    expect(new Set(fields).size).toBe(fields.length);
  });

  it('requires both PINFL and passport', () => {
    const probs = poaDraftProblems({ ...full, personPinfl: '', personPassport: '' });
    expect(probs.some((p) => p.field === 'personPinfl')).toBe(true);
    expect(probs.some((p) => p.field === 'personPassport')).toBe(true);
  });
});
