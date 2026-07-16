import { describe, it, expect } from 'vitest';
import {
  maskAmount, unmaskAmount, maskPhone, unmaskPhone,
  maskPassport, maskStir, maskAccount, maskMfo,
} from './mask';

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
