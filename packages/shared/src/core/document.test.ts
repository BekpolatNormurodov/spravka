import { describe, it, expect } from 'vitest';
import { contractTypePlural, formatSum, dmy, uzLongDate, uzLongDateToIso } from './document';
import {
  uzLongDateLatin, uzLongDateLatinToIso, arizaHeaderDate,
  formatSumDecimal, unmaskAmountDecimal, maskAmountDecimal,
} from './document';

describe('Latin long dates', () => {
  const d = new Date(Date.UTC(2026, 6, 15)); // 15 July 2026
  it('formats long-form', () => expect(uzLongDateLatin(d)).toBe('2026 yil 15 iyul'));
  it('round-trips', () => expect(uzLongDateLatinToIso('2026 yil 15 iyul')).toBe('2026-07-15'));
  it('is forgiving of case and spacing', () =>
    expect(uzLongDateLatinToIso('  2026  yil 1 Yanvar ')).toBe('2026-01-01'));
  it('rejects a non-day', () => expect(uzLongDateLatinToIso('2026 yil 31 fevral')).toBe(''));
  it('formats the header date with two spaces', () =>
    expect(arizaHeaderDate(d)).toBe('"15"  iyul 2026-yil'));
});

describe('decimal money', () => {
  it('groups thousands and comma-decimals the tiyin', () =>
    expect(formatSumDecimal('24318882.63')).toBe('24 318 882,63'));
  it('drops the comma for a whole amount', () =>
    expect(formatSumDecimal('24900000')).toBe('24 900 000'));
  it('unmasks to a dot-decimal for the API', () =>
    expect(unmaskAmountDecimal('24 318 882,63')).toBe('24318882.63'));
  it('masks progressively as it is typed', () =>
    expect(maskAmountDecimal('24318882,6')).toBe('24 318 882,6'));
  it('caps to two decimals', () => expect(maskAmountDecimal('1,239')).toBe('1,23'));
});

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
