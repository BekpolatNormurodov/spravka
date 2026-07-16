import { describe, it, expect } from 'vitest';
import { formatCertNumber, counterId } from './numbering';

describe('formatCertNumber', () => {
  it('formats date as DDMMYYYY and pads seq to 2 digits', () => {
    expect(formatCertNumber(new Date(2026, 5, 26), 4)).toBe('26062026/04');
  });
  it('keeps seq wider than 2 digits', () => {
    expect(formatCertNumber(new Date(2026, 0, 1), 123)).toBe('01012026/123');
  });
});

describe('counterId', () => {
  it('combines firmId and year', () => {
    expect(counterId('firm_x', 2026)).toBe('firm_x:2026');
  });
});
