import { describe, expect, it } from 'vitest';
import { CERT_FIELD_LABELS, missingFieldsError, type CertField } from './labels';

const REQUIRED = [
  'personFullName', 'personPassport', 'loanAmount', 'asOfDate', 'issueDate',
] as const satisfies readonly CertField[];

const full = {
  personFullName: 'КАМБАРОВА МОХИРА',
  personPassport: 'AA1234567',
  loanAmount: '15000000',
  asOfDate: '2026-06-25',
  issueDate: '2026-06-26',
};

describe('missingFieldsError', () => {
  it('says nothing when nothing is missing', () => {
    expect(missingFieldsError(full, REQUIRED)).toBeNull();
  });

  it('names the field the way the document does, not the way the code does', () => {
    // The bug this replaced: «Maydon toʻldirilmagan: personFullName».
    const msg = missingFieldsError({ ...full, personFullName: '' }, REQUIRED);
    expect(msg).toBe('Mijozning F.I.SH. toʻldirilmagan');
    expect(msg).not.toContain('personFullName');
  });

  it('lists all of them at once, so fixing one does not reveal the next', () => {
    expect(missingFieldsError({ ...full, personFullName: '', loanAmount: '' }, REQUIRED))
      .toBe('Toʻldirilmagan maydonlar: Mijozning F.I.SH., Kredit summasi');
  });

  it('keeps them in the order they were asked for', () => {
    const msg = missingFieldsError({}, REQUIRED)!;
    expect(msg.indexOf('F.I.SH.')).toBeLessThan(msg.indexOf('Kredit summasi'));
  });

  it('has a label for every field a maʼlumotnoma is written from', () => {
    // A missing entry would print `undefined` at the person rather than a field name.
    for (const label of Object.values(CERT_FIELD_LABELS)) {
      expect(label).toBeTruthy();
      expect(label).not.toMatch(/^[a-z]+[A-Z]/); // not a property name that slipped through
    }
  });
});
