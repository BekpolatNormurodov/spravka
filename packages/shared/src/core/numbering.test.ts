import { describe, it, expect } from 'vitest';
import { formatCertNumber, counterId, certDay } from './numbering';
import { dmy } from './document';

// Dates arrive as UTC midnight — `new Date('2026-06-26')`, which is what the API stores when the
// yurist picks a day. Constructing them with `new Date(2026, 5, 26)` here would be local midnight,
// a value the app never actually holds, and would hide exactly the bug these tests exist to catch.
const day = (iso: string) => new Date(iso);

describe('formatCertNumber', () => {
  it('formats date as DDMMYYYY and pads seq to 2 digits', () => {
    expect(formatCertNumber(day('2026-06-26'), 4)).toBe('26062026/04');
  });

  it('keeps seq wider than 2 digits', () => {
    expect(formatCertNumber(day('2026-01-01'), 123)).toBe('01012026/123');
  });

  it('reads the date the same way the document prints it', () => {
    // The invariant that matters: the number and the date sit on the same page, from the same
    // field. Reading one in local time and the other in UTC printed «25062026/01» above
    // «26.06.2026» on any host west of Greenwich — right in Tashkent, wrong elsewhere.
    for (const iso of ['2026-06-26', '2026-01-01', '2026-12-31', '2027-01-01']) {
      const d = day(iso);
      expect(formatCertNumber(d, 1).slice(0, 8)).toBe(dmy(d).replace(/\./g, ''));
    }
  });

  it('does not shift with the host timezone', () => {
    // Same instant, whatever the server is set to: a UTC-midnight value renders its UTC day.
    expect(formatCertNumber(new Date('2026-06-26T00:00:00.000Z'), 1)).toBe('26062026/01');
    // And a value late in the UTC day still belongs to that UTC day, not tomorrow in Tashkent.
    expect(formatCertNumber(new Date('2026-06-26T23:30:00.000Z'), 1)).toBe('26062026/01');
  });
});

describe('certDay', () => {
  it('is the UTC day, matching the number and the printed date', () => {
    expect(certDay(day('2027-01-01'))).toBe('2027-01-01');
    // 23:00 UTC on the 31st is already the 1st in Tashkent. The number, the printed date and the
    // counter all read the field the same way, so they agree wherever the host sits.
    expect(certDay(new Date('2026-12-31T23:00:00.000Z'))).toBe('2026-12-31');
  });
});

describe('counterId', () => {
  it('combines firmId and day, so NN restarts each morning', () => {
    expect(counterId('firm_x', '2026-07-20')).toBe('firm_x:2026-07-20');
  });

  it('gives two firms separate sequences on the same day', () => {
    expect(counterId('firm_a', '2026-07-20')).not.toBe(counterId('firm_b', '2026-07-20'));
  });

  it('gives one firm separate sequences on different days', () => {
    expect(counterId('firm_a', '2026-07-20')).not.toBe(counterId('firm_a', '2026-07-21'));
  });
});

describe('the number a day produces', () => {
  it('starts at 01 and counts up within the day', () => {
    expect(formatCertNumber(day('2026-07-20'), 1)).toBe('20072026/01');
    expect(formatCertNumber(day('2026-07-20'), 2)).toBe('20072026/02');
  });

  it('starts again at 01 the next day, and the date keeps them apart', () => {
    expect(formatCertNumber(day('2026-07-21'), 1)).toBe('21072026/01');
    expect(formatCertNumber(day('2026-07-20'), 1)).not.toBe(formatCertNumber(day('2026-07-21'), 1));
  });
});
