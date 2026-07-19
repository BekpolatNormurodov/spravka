import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRequire } from 'node:module';
import { CertificateDocument, type CertificateDocumentProps } from './CertificateDocument';
import {
  certificateEditSlots, draftProblems, draftContracts, previewContracts,
  initialHistory, reduceDraft, asDate,
  type CertDraft,
} from './DocumentEdit';

const renderToStaticMarkup: (el: React.ReactElement) => string =
  createRequire(import.meta.url)('react-dom/server').renderToStaticMarkup;

const draft = (over: Partial<CertDraft> = {}): CertDraft => ({
  personPinfl: '12345678901234',
  personFullName: 'КАМБАРОВА МОХИРА ХАСАНОВНА',
  personPassport: 'AA1234567',
  passportIssuedBy: 'Олмазор ИИБ',
  passportIssuedAt: '2020-01-15',
  contracts: [
    { number: '8130', date: '2026-05-14' },
    { number: '28324', date: '2026-05-26' },
  ],
  contractType: '«Микроқарз» универсал шартномаси',
  loanAmount: '15000000',
  asOfDate: '2026-06-25',
  issueDate: '2026-06-26',
  ...over,
});

const FIRM = {
  name: '«BRIGHT FUTURE FINANCING» МЧЖ',
  letterheadName: '«BRIGHT FUTURE FINANCING» MCHJ',
  directorName: 'А.А.Бойназаров',
  directorPosition: 'Ижрочи директори',
  stir: '311976765',
};

/** What the document says, with markup and whitespace differences taken out of the comparison. */
function words(markup: string): string {
  return markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function docProps(d: CertDraft): CertificateDocumentProps {
  return {
    number: '26062026/01',
    issueDate: asDate(d.issueDate),
    personFullName: d.personFullName,
    personPassport: d.personPassport,
    passportIssuedBy: d.passportIssuedBy,
    passportIssuedAt: asDate(d.passportIssuedAt),
    contracts: previewContracts(d),
    contractType: d.contractType,
    loanAmount: d.loanAmount,
    asOfDate: asDate(d.asOfDate),
    firm: FIRM,
  };
}

const noop = () => {};
const slots = (d: CertDraft) =>
  certificateEditSlots(d, { patch: noop, undo: noop, redo: noop, invalid: () => false });

describe('editing and printing agree', () => {
  /*
    The load-bearing test. The whole design rests on there being one CertificateDocument rather
    than an editable copy beside it; this is what would fail if a copy ever appeared, or if a slot
    started formatting a value differently from the way the PDF prints it.
  */
  it('renders the same words with and without the edit slots', () => {
    const d = draft();
    const printed = renderToStaticMarkup(React.createElement(CertificateDocument, docProps(d)));
    const editing = renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), edit: slots(d) }),
    );
    expect(words(editing)).toBe(words(printed));
  });

  it('shows the sum grouped the way it prints', () => {
    const d = draft({ loanAmount: '4000000' });
    const editing = renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), edit: slots(d) }),
    );
    expect(words(editing)).toContain('4 000 000 сўм');
  });

  it('keeps every contract in the sentence', () => {
    const d = draft();
    const editing = words(renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), edit: slots(d) }),
    ));
    expect(editing).toContain('14.05.2026 йилдаги 8130-сонли');
    expect(editing).toContain('26.05.2026 йилдаги 28324-сонли');
  });

  it('offers the issuer slots even when they are empty, which the printed page omits', () => {
    // The one deliberate divergence — the optional values need somewhere to be typed. The
    // print-preview toggle drops `edit`, which is the branch asserted on the left here.
    const d = draft({ passportIssuedBy: '', passportIssuedAt: '' });
    const printed = words(renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), passportIssuedAt: null }),
    ));
    const editing = words(renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), edit: slots(d) }),
    ));
    expect(printed).not.toContain('томонидан берилган');
    expect(editing).toContain('томонидан берилган');
  });
});

describe('the top table, as the blank writes it', () => {
  /*
    Three details measured off the source document on 2026-07-19. Each was previously rendered the
    other way round, and each is invisible enough to be "tidied" back by someone reading the code
    without the blank in front of them. Pinned here so that costs a failing test.
  */
  const printed = () => words(renderToStaticMarkup(
    React.createElement(CertificateDocument, docProps(draft())),
  ));

  it('ends the date with й', () => {
    expect(printed()).toContain('Сана: 26.06.2026 й');
  });

  it('puts a space after №', () => {
    expect(printed()).toContain('№ 26062026/01');
  });

  it('addresses the person with a lowercase га', () => {
    expect(printed()).toContain('КАМБАРОВА МОХИРА ХАСАНОВНАга');
  });

  it('leaves the № row out entirely when the ariza has no number and is not being written', () => {
    const markup = renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(draft()), number: '' }),
    );
    expect(words(markup)).not.toContain('№');
  });

  it('keeps the row while writing, filled with a note that cannot print', () => {
    const d = draft();
    const markup = renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), number: '', edit: slots(d) }),
    );
    expect(words(markup)).toContain('№');
    // `no-print` is what keeps it off paper; without that class it would be printed text.
    expect(markup).toContain('cert-hint no-print');
  });
});

describe('undo history', () => {
  it('undoes and redoes back to where it started', () => {
    const a = draft();
    const b = draft({ personFullName: 'ЖЎРАБЕКОВ АЗИЗ' });
    let s = initialHistory(a);
    s = reduceDraft(s, { type: 'set', value: b });
    s = reduceDraft(s, { type: 'commit' });

    s = reduceDraft(s, { type: 'undo' });
    expect(s.present.personFullName).toBe(a.personFullName);

    s = reduceDraft(s, { type: 'redo' });
    expect(s.present.personFullName).toBe(b.personFullName);
  });

  it('treats typing that has not settled yet as a step', () => {
    // Ctrl+Z immediately after typing, before the quiet period fires. Without this the keystroke
    // would be skipped and undo would jump past it to the previous word.
    const a = draft();
    let s = initialHistory(a);
    s = reduceDraft(s, { type: 'set', value: draft({ loanAmount: '900' }) });
    s = reduceDraft(s, { type: 'undo' });
    expect(s.present.loanAmount).toBe(a.loanAmount);
  });

  it('undoes a contract row being added', () => {
    const a = draft();
    let s = initialHistory(a);
    s = reduceDraft(s, {
      type: 'set',
      value: { ...a, contracts: [...a.contracts, { number: '', date: '' }] },
    });
    s = reduceDraft(s, { type: 'commit' });
    expect(s.present.contracts).toHaveLength(3);

    s = reduceDraft(s, { type: 'undo' });
    expect(s.present.contracts).toHaveLength(2);
  });

  it('does nothing at the ends', () => {
    const s = initialHistory(draft());
    expect(reduceDraft(s, { type: 'undo' })).toBe(s);
    expect(reduceDraft(s, { type: 'redo' })).toBe(s);
  });

  it('drops the redo trail once a new edit is made', () => {
    let s = initialHistory(draft());
    s = reduceDraft(s, { type: 'set', value: draft({ loanAmount: '1' }) });
    s = reduceDraft(s, { type: 'commit' });
    s = reduceDraft(s, { type: 'undo' });
    expect(s.future).toHaveLength(1);

    s = reduceDraft(s, { type: 'set', value: draft({ loanAmount: '2' }) });
    expect(s.future).toHaveLength(0);
  });

  it('caps the history rather than growing without bound', () => {
    let s = initialHistory(draft());
    for (let i = 0; i < 80; i++) {
      s = reduceDraft(s, { type: 'set', value: draft({ loanAmount: String(i) }) });
      s = reduceDraft(s, { type: 'commit' });
    }
    expect(s.past.length).toBeLessThanOrEqual(50);
  });
});

describe('what reaches the API', () => {
  it('reports each missing value once, in the order it appears on the page', () => {
    const problems = draftProblems(
      draft({ personFullName: '', personPassport: '', loanAmount: '' }),
      { pinfl: true },
    );
    expect(problems.map((p) => p.field)).toEqual(['personFullName', 'personPassport', 'loanAmount']);
  });

  it('accepts a complete draft', () => {
    expect(draftProblems(draft(), { pinfl: true })).toEqual([]);
  });

  it('rejects a PINFL that is not fourteen digits, but only where one is asked for', () => {
    const d = draft({ personPinfl: '123' });
    expect(draftProblems(d, { pinfl: true })[0]?.field).toBe('personPinfl');
    expect(draftProblems(d, { pinfl: false })).toEqual([]);
  });

  it('rejects a half-filled contract row', () => {
    const d = draft({ contracts: [{ number: '8130', date: '' }] });
    expect(draftProblems(d, { pinfl: true })[0]?.field).toBe('contracts');
  });

  it('drops a row the person started and left blank', () => {
    const d = draft({ contracts: [{ number: '8130', date: '2026-05-14' }, { number: '', date: '' }] });
    expect(draftContracts(d)).toEqual([{ number: '8130', date: '2026-05-14' }]);
  });
});
