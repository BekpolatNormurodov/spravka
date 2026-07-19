import { describe, it, expect } from 'vitest';
import { contractTypePlural, formatSum, dmy, uzLongDate, uzLongDateToIso } from './document';

describe('contractTypePlural', () => {
  // The blanks write the first paragraph in the plural («…шартномаларига асосан умумий»)
  // and the second in the singular, whether they list one contract or two.
  it('pluralises the possessive the blanks use', () => {
    expect(contractTypePlural('«Микроқарз» универсал шартномаси')).toBe(
      '«Микроқарз» универсал шартномалари',
    );
  });

  it('leaves a type it cannot inflect alone', () => {
    // 'Shartnoma turi' is a free-text field — an unexpected value must pass through
    // untouched rather than get mangled.
    expect(contractTypePlural('Кредит шартнома')).toBe('Кредит шартнома');
    expect(contractTypePlural('')).toBe('');
  });

  it('only touches the ending, not an -си inside the words', () => {
    expect(contractTypePlural('Ипотекаси шартномаси')).toBe('Ипотекаси шартномалари');
  });
});

describe('formatSum', () => {
  it('groups thousands the way the blank prints them', () => {
    expect(formatSum('20000000')).toBe('20 000 000');
    expect(formatSum('4000000')).toBe('4 000 000');
    expect(formatSum('500')).toBe('500');
  });
});

describe('dates', () => {
  it('dmy matches the Сана: line', () => {
    expect(dmy(new Date('2026-07-14T00:00:00Z'))).toBe('14.07.2026');
  });

  it('uzLongDate matches the «ҳолатида» line', () => {
    expect(uzLongDate(new Date('2026-07-14T00:00:00Z'))).toBe('2026 йил 14 июль');
  });
});

describe('uzLongDateToIso', () => {
  it('reads back what uzLongDate wrote', () => {
    const d = new Date('2026-06-26T00:00:00.000Z');
    expect(uzLongDateToIso(uzLongDate(d))).toBe('2026-06-26');
  });

  it('forgives spacing and case', () => {
    expect(uzLongDateToIso('  2026 йил   19  ИЮЛЬ ')).toBe('2026-07-19');
  });

  it('reads every month name the document uses', () => {
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(2026, m, 15));
      expect(uzLongDateToIso(uzLongDate(d))).toBe(d.toISOString().slice(0, 10));
    }
  });

  it('comes back empty rather than guessing', () => {
    // The caller keeps the previous date when this is empty, so a wrong guess would be a silently
    // wrong date on a legal document.
    expect(uzLongDateToIso('2026 йил 19')).toBe('');
    expect(uzLongDateToIso('19.07.2026')).toBe('');
    expect(uzLongDateToIso('2026 йил 19 сентябр')).toBe('');
    expect(uzLongDateToIso('')).toBe('');
  });

  it('refuses a day that does not exist in that month', () => {
    expect(uzLongDateToIso('2026 йил 31 июнь')).toBe('');
  });
});
