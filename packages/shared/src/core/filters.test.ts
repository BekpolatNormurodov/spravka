import { describe, it, expect } from 'vitest';
import { parseCertFilters, buildCertWhere, pageHref, type ParsedFilters } from './filters';

const STATUSES = ['DRAFT', 'SIGNED'] as const;

describe('parseCertFilters — docType', () => {
  it('keeps a real document type', () =>
    expect(parseCertFilters({ docType: 'ISHONCHNOMA' }, STATUSES).docType).toBe('ISHONCHNOMA'));

  it('drops an unknown type rather than matching nothing', () =>
    expect(parseCertFilters({ docType: 'NONSENSE' }, STATUSES).docType).toBeUndefined());

  it('is undefined when absent', () =>
    expect(parseCertFilters({}, STATUSES).docType).toBeUndefined());
});

describe('buildCertWhere — docType', () => {
  it('narrows to the chosen type', () => {
    const where = buildCertWhere({ docType: 'ARIZA', page: 1 });
    expect(where.docType).toBe('ARIZA');
  });

  it('omits the key entirely when no type is chosen', () => {
    const where = buildCertWhere({ page: 1 });
    expect('docType' in where).toBe(false);
  });

  it('searches PINFL alongside passport', () => {
    const where = buildCertWhere({ q: '123', page: 1 }) as { OR: Record<string, unknown>[] };
    const fields = where.OR.map((c) => Object.keys(c)[0]);
    expect(fields).toContain('personPinfl');
    expect(fields).toContain('personPassport');
  });
});

describe('pageHref — docType round-trips', () => {
  it('carries the type across pages', () => {
    const p: ParsedFilters = { docType: 'ISHONCHNOMA', page: 1 };
    expect(pageHref('/', p, 2)).toBe('/?docType=ISHONCHNOMA&page=2');
  });
});
