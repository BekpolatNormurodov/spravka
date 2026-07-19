import { describe, it, expect } from 'vitest';
import {
  maskAmount, unmaskAmount, maskPhone, unmaskPhone,
  maskPassport, maskStir, maskAccount, maskMfo, maskPinfl, isValidPinfl,
  maskDmy,
} from './mask';
import { dmyToIso, isoToDmy } from './calendar';

describe('maskAmount', () => {
  it('groups thousands with spaces', () => {
    expect(maskAmount('4000000')).toBe('4 000 000');
    expect(maskAmount('999')).toBe('999');
    expect(maskAmount('1234')).toBe('1 234');
  });
  it('ignores non-digits and is idempotent', () => {
    expect(maskAmount('4 000 000')).toBe('4 000 000');
    expect(maskAmount('4a0b0c0000')).toBe('4 000 000');
  });
  it('strips leading zeros but keeps a lone zero', () => {
    expect(maskAmount('007')).toBe('7');
    expect(maskAmount('0')).toBe('0');
  });
  it('unmasks back to raw digits', () => {
    expect(unmaskAmount('4 000 000')).toBe('4000000');
  });
});

describe('maskPhone', () => {
  it('formats a full uzbek number', () => {
    expect(maskPhone('998901234567')).toBe('+998 90 123 45 67');
    expect(maskPhone('901234567')).toBe('+998 90 123 45 67');
  });
  it('keeps partial input partial while typing', () => {
    expect(maskPhone('90')).toBe('+998 90');
    expect(maskPhone('90123')).toBe('+998 90 123');
  });
  it('returns empty for empty input', () => {
    expect(maskPhone('')).toBe('');
  });
  it('unmasks to E.164-ish digits', () => {
    expect(unmaskPhone('+998 90 123 45 67')).toBe('+998901234567');
  });
});

describe('maskPassport', () => {
  it('uppercases and enforces 2 letters + 7 digits', () => {
    expect(maskPassport('ae5348993')).toBe('AE5348993');
    expect(maskPassport('AE 5348993')).toBe('AE5348993');
  });
  it('truncates extra digits', () => {
    expect(maskPassport('AE12345678999')).toBe('AE1234567');
  });
});

describe('bank + tax masks', () => {
  it('stir is 9 digits', () => {
    expect(maskStir('311976765')).toBe('311976765');
    expect(maskStir('31197676599')).toBe('311976765');
  });
  it('mfo is 5 digits', () => {
    expect(maskMfo('011839')).toBe('01183');
  });
  it('account groups 20 digits in 4s', () => {
    expect(maskAccount('20216000207212842001')).toBe('2021 6000 2072 1284 2001');
  });
});

describe('maskPinfl', () => {
  it('keeps digits only, max 14', () => {
    expect(maskPinfl('12345678901234')).toBe('12345678901234');
    expect(maskPinfl('1234 5678 9012 34')).toBe('12345678901234');
    expect(maskPinfl('123456789012349999')).toBe('12345678901234');
  });
  it('validates a full pinfl', () => {
    expect(isValidPinfl('12345678901234')).toBe(true);
    expect(isValidPinfl('1234567890123')).toBe(false);
    expect(isValidPinfl('abcdefghijklmn')).toBe(false);
  });
});

describe('dates typed into the document', () => {
  it('formats digits as they are typed, dots or no dots', () => {
    expect(maskDmy('27102024')).toBe('27.10.2024');
    expect(maskDmy('27.10.2024')).toBe('27.10.2024');
    expect(maskDmy('2710')).toBe('27.10');
    expect(maskDmy('27')).toBe('27');
  });

  it('stops at a whole date instead of growing a tail', () => {
    expect(maskDmy('271020249999')).toBe('27.10.2024');
  });

  it('reads a whole date and refuses a partial one', () => {
    // The pairing that matters: whatever maskDmy emits is what dmyToIso is asked to read.
    expect(dmyToIso(maskDmy('27102024'))).toBe('2024-10-27');
    expect(dmyToIso(maskDmy('2710'))).toBe('');
    expect(dmyToIso('')).toBe('');
  });

  it('refuses a date that does not exist rather than rolling it forward', () => {
    // new Date(2024, 1, 31) is 2 March. A maʼlumotnoma must not quietly say a different day.
    expect(dmyToIso('31.02.2024')).toBe('');
    expect(dmyToIso('00.10.2024')).toBe('');
    expect(dmyToIso('27.13.2024')).toBe('');
  });

  it('shows a stored date the way it is read', () => {
    expect(isoToDmy('2024-10-27')).toBe('27.10.2024');
    expect(isoToDmy('')).toBe('');
  });
});
