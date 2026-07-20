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
  asOfText: '2026 йил 25 июнь',
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
    asOfText: d.asOfText,
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

  it('never lets a placeholder reach the printed page', () => {
    /*
      The examples in empty slots are the one thing on this screen that would be a forgery if it
      printed — «AA1234567» on an issued maʼlumotnoma is a passport number the holder does not
      have. They are safe by construction (a placeholder is an attribute, and the PDF renders with
      no `edit` prop at all), and this is what keeps that true.
    */
    // Every slot a placeholder could fill is emptied, so anything matching below leaked.
    const d = draft({
      personPassport: '', loanAmount: '', personFullName: '', asOfDate: '',
      passportIssuedBy: '', passportIssuedAt: '', contracts: [],
    });
    const printed = words(renderToStaticMarkup(
      React.createElement(CertificateDocument, docProps(d)),
    ));
    for (const sample of ['AA1234567', '4 000 000', 'Ф.И.Ш.', '01.01.2026', 'Олмазор ИИБ', '8130']) {
      expect(printed).not.toContain(sample);
    }
    // The template itself is untouched by any of them being missing.
    expect(printed).toContain('сўм миқдорида кредитлар ажратилган');
  });

  it('shows those examples while the document is being written', () => {
    const d = draft({ personPassport: '', personFullName: '' });
    const markup = renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), edit: slots(d) }),
    );
    // Carried as attributes, not text — which is why the print branch cannot pick them up.
    expect(markup).toContain('data-placeholder="Ф.И.Ш."');
    expect(markup).toContain('data-placeholder="AA1234567"');
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

  it('leaves it out while the ariza is being written too', () => {
    // The counter issues the number on save. Nothing stands in for it in the meantime: a mark in
    // the place of a certificate number is a mark that is not a certificate number.
    const d = draft();
    const markup = renderToStaticMarkup(
      React.createElement(CertificateDocument, { ...docProps(d), number: '', edit: slots(d) }),
    );
    expect(words(markup)).not.toContain('№');
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

  it('lets an otherwise complete draft be saved with no PINFL at all', () => {
    // Saving a draft passes `pinfl: false`; submitting passes true. The yurist is often working
    // from a contract that has the name and passport on it and the PINFL somewhere else, and the
    // ariza is worth keeping in the meantime.
    const d = draft({ personPinfl: '' });
    expect(draftProblems(d, { pinfl: false })).toEqual([]);
    expect(draftProblems(d, { pinfl: true }).map((p) => p.field)).toEqual(['personPinfl']);
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

describe('what a draft has to have', () => {
  /*
    A draft is held to the same standard as a submission, PINFL included. Saving one allocates a
    maʼlumotnoma number that is never reused, so an ariza too empty to be worth a number is not
    worth saving — the sheet keeps itself in the browser until it is.
  */
  it('wants the PINFL as much as everything else', () => {
    const d = draft({ personPinfl: '' });
    expect(draftProblems(d, { pinfl: true }).map((p) => p.field)).toEqual(['personPinfl']);
  });

  it('is satisfied by a complete document', () => {
    expect(draftProblems(draft(), { pinfl: true })).toEqual([]);
  });

  it('names every empty one at once, in the order they appear on the page', () => {
    const d = draft({ personPinfl: '', personFullName: '', loanAmount: '' });
    expect(draftProblems(d, { pinfl: true }).map((p) => p.field))
      .toEqual(['personPinfl', 'personFullName', 'loanAmount']);
  });
});

describe('strict checks', () => {
  const fields = (d: CertDraft) => draftProblems(d, { pinfl: true }).map((p) => p.field);

  it('refuses a contract dated on a day that does not exist', () => {
    // 31.02 reaches MySQL as 3 March, and the document then names a day the contract was not
    // signed on — wrong, printed, and impossible to spot afterwards.
    expect(fields(draft({ contracts: [{ number: '8130', date: '2026-02-31' }] }))).toContain('contracts');
  });

  it('refuses a sum of zero', () => {
    expect(fields(draft({ loanAmount: '0' }))).toContain('loanAmount');
  });

  it('refuses a holat phrase it cannot read', () => {
    // asOfDate keeps its last good value when the phrase is unreadable, so checking the date
    // instead of the words would pass a document that says something else.
    expect(fields(draft({ asOfText: '2026 йил 19' }))).toContain('asOfText');
    expect(fields(draft({ asOfText: 'ЛОРЕМ ИПСУМ' }))).toContain('asOfText');
  });

  it('accepts the phrase in the shape the document prints', () => {
    expect(fields(draft({ asOfText: '2026 йил 19 июль' }))).toEqual([]);
  });

  it('counts the digits back when the PINFL is short', () => {
    const p = draftProblems(draft({ personPinfl: '123' }), { pinfl: true })[0];
    expect(p?.message).toContain('3 ta');
  });

  it('says it plainly when the PINFL is empty', () => {
    expect(draftProblems(draft({ personPinfl: '' }), { pinfl: true })[0]?.message).toBe('PINFL kiritilmagan');
  });
});
