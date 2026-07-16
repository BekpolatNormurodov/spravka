import { describe, it, expect } from 'vitest';
import { parseContracts } from './contracts';

const ok = (r: ReturnType<typeof parseContracts>) => {
  if ('error' in r) throw new Error(`kutilmagan xato: ${r.error}`);
  return r.contracts;
};

describe('parseContracts', () => {
  it('keeps the order the form sent — the document prints them in it', () => {
    const c = ok(
      parseContracts([
        { number: '8130', date: '2026-05-14' },
        { number: '28324', date: '2026-05-26' },
      ]),
    );
    expect(c.map((x) => x.number)).toEqual(['8130', '28324']);
    expect(c.map((x) => x.order)).toEqual([0, 1]);
    expect(c[0]!.date.toISOString().slice(0, 10)).toBe('2026-05-14');
  });

  it('accepts a single contract', () => {
    expect(ok(parseContracts([{ number: '15219', date: '2026-07-10' }]))).toHaveLength(1);
  });

  it('drops a row the user added but left blank, and renumbers', () => {
    const c = ok(
      parseContracts([
        { number: '8130', date: '2026-05-14' },
        { number: '  ', date: '' },
        { number: '28324', date: '2026-05-26' },
      ]),
    );
    expect(c.map((x) => x.number)).toEqual(['8130', '28324']);
    expect(c.map((x) => x.order)).toEqual([0, 1]);
  });

  it('trims the number', () => {
    expect(ok(parseContracts([{ number: ' 8130 ', date: '2026-05-14' }]))[0]!.number).toBe('8130');
  });

  it('refuses a half-filled row rather than issuing a document without a date', () => {
    expect(parseContracts([{ number: '8130', date: '' }])).toEqual({
      error: 'Shartnoma sanasini tanlang',
    });
    expect(parseContracts([{ number: '', date: '2026-05-14' }])).toEqual({
      error: 'Shartnoma raqamini yozing',
    });
  });

  it('refuses an unparseable date', () => {
    const r = parseContracts([{ number: '8130', date: 'kecha' }]);
    expect('error' in r && r.error).toContain('notoʻgʻri');
  });

  it('refuses an empty list — a maʼlumotnoma always covers something', () => {
    expect(parseContracts([])).toEqual({ error: 'Kamida bitta shartnoma kiriting' });
    expect(parseContracts(undefined)).toEqual({ error: 'Kamida bitta shartnoma kiriting' });
    expect(parseContracts('8130')).toEqual({ error: 'Kamida bitta shartnoma kiriting' });
  });
});
