import { describe, expect, it } from 'vitest';
import { certificateHtml } from './html';
import type { CertificateDocumentProps } from '../ui/CertificateDocument';

const props: CertificateDocumentProps = {
  number: '26062026/01',
  issueDate: new Date('2026-06-26'),
  personFullName: 'КАМБАРОВА МОХИРА ХАСАНОВНА',
  personPassport: 'AA1234567',
  passportIssuedBy: 'Олмазор ИИБ',
  passportIssuedAt: new Date('2020-01-15'),
  contracts: [
    { number: '8130', date: new Date('2026-05-14') },
    { number: '28324', date: new Date('2026-05-26') },
  ],
  contractType: '«Микроқарз» универсал шартномаси',
  loanAmount: '15000000',
  asOfDate: new Date('2026-06-25'),
  firm: {
    name: '«BRIGHT FUTURE FINANCING» МЧЖ',
    letterheadName: '«BRIGHT FUTURE FINANCING» MCHJ',
    directorName: 'А.А.Бойназаров',
    directorPosition: 'Ижрочи директори',
    executorName: 'Б.Тоиров',
    executorPhone: '+99855-503-01-90',
    stir: '311976765',
    bankAccount: '20216000207212842001',
    mfo: '01183',
    bankName: 'АО "ANORBANK"',
  },
  signed: true,
  qrDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
};

/** What is left once every inlined blob is removed — i.e. anything the page would go fetch. */
const withoutDataUris = (html: string) => html.replace(/data:[^)"']+/g, '');

describe('certificateHtml', () => {
  const html = certificateHtml(props);

  it('is a complete standalone document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('@font-face');
    expect(html).toContain('.cert-sheet');
  });

  it('fetches nothing', () => {
    // Not a nicety: anything fetched would make a signed document depend on the network being up
    // at that moment, and fail by looking quietly wrong rather than by erroring.
    const rest = withoutDataUris(html);
    expect(rest).not.toMatch(/https?:\/\//);
    expect(rest).not.toMatch(/url\(\s*\/\//);
    expect(rest).not.toContain('<link');
    expect(rest).not.toContain('<script');
  });

  it('prints A4 with no printer margins of its own', () => {
    // The sheet already carries the .docx margins; a second set would inset them twice.
    expect(html).toContain('@page{size:A4;margin:0}');
    expect(html).toContain('width:210mm');
  });

  it('renders the document body, not an empty shell', () => {
    expect(html).toContain('МАЪЛУМОТНОМА');
    expect(html).toContain('26062026/01');
    expect(html).toContain('КАМБАРОВА МОХИРА ХАСАНОВНА');
    expect(html).toContain('А.А.Бойназаров');
  });

  it('lists every contract, in order', () => {
    // A maʼlumotnoma that silently dropped a contract would be wrong in the worst way: readable.
    expect(html).toContain('8130');
    expect(html).toContain('28324');
    expect(html.indexOf('8130')).toBeLessThan(html.indexOf('28324'));
  });

  it('stamps a signed document ТАСДИҚЛАНДИ', () => {
    expect(html).toContain('ТАСДИҚЛАНДИ');
    expect(html).not.toContain('ТАСДИҚЛАНМАГАН');
  });

  it('embeds the QR that was passed in', () => {
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=');
  });
});
