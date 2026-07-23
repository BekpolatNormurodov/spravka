import { describe, expect, it } from 'vitest';
import { certificateHtml, courtArizaHtml } from './html';
import type { CertificateDocumentProps } from '../ui/CertificateDocument';
import type { CourtArizaDocumentProps } from '../ui/CourtArizaDocument';

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
  infoRecipient: '«KAPITAL SUGʻURTA» Акциядорлик жамиятига',
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

  it('carries no stamp of ours', () => {
    // The rotated ТАСДИҚЛАНДИ badge was removed: the source blank has no such mark, and it was the
    // one thing on an issued document that announced it came out of a web app.
    expect(html).not.toContain('ТАСДИҚЛАНДИ');
    expect(html).not.toContain('ТАСДИҚЛАНМАГАН');
  });

  it('prints the «Маълумот учун» addressee under the first one', () => {
    expect(html).toContain('Маълумот учун:');
    expect(html).toContain('Акциядорлик жамиятига');
    // Under, not over — it is the second addressee, and the order is what says which is which.
    expect(html.indexOf('КАМБАРОВА')).toBeLessThan(html.indexOf('Маълумот учун:'));
  });

  it('leaves the line out entirely when there is no second addressee', () => {
    // Which is the ordinary case, and every row issued before the field existed.
    expect(certificateHtml({ ...props, infoRecipient: null })).not.toContain('Маълумот учун');
  });

  it('embeds the QR that was passed in', () => {
    expect(html).toContain('data:image/png;base64,iVBORw0KGgo=');
  });

  it('carries no ariza sentence — the two documents do not bleed into each other', () => {
    expect(html).not.toContain('S Oʻ R A Y M I Z');
    expect(html).not.toContain('sudiga');
    expect(html).not.toContain('Palata aʼzosi');
  });
});

const arizaProps: CourtArizaDocumentProps = {
  number: '0001/09-02',
  issueDate: new Date('2026-07-15'),
  courtName: 'Fuqarolik ishlari boʻyicha Uchtepa tumanlararo sudiga',
  personFullName: 'Abdiyeva Muazzamxon Muxsin qizi',
  personPinfl: '61011006920020',
  personAddress: 'Fargʻona viloyati, Buvayda tumani',
  personPhone: '998952962728',
  contracts: [{ number: '22548', date: new Date('2026-04-14') }],
  contractType: 'ONLAYN', interestRate: '54', loanAmount: '24900000',
  asOfDate: new Date('2026-07-15'), asOfText: '2026 yil 15 iyul',
  debtPrincipal: '24318882.63', debtTermInterest: '143914.49',
  debtOverduePrincipal: '577575.43', debtOverdueInterest: '2224630.19', debtTotal: '27265002.74',
  chamberSignerPosition: 'Boshqarma boshligʻi oʻrinbosari', chamberSignerName: 'B.Babamuradov',
  chamberExecutorName: 'B.Fayziyev', chamberExecutorPhone: '+99895-144-24-00',
  firm: {
    name: '«BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI» МЧЖ',
    letterheadName: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” MMT MCHJ',
    directorName: 'A.A.', directorPosition: 'Direktor',
    address: 'Toshkent shahar, Olmazor tumani', stir: '311 976 765',
    bankAccount: '20216000207212842001', mfo: '01183',
  },
  qrDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
};

describe('courtArizaHtml', () => {
  const html = courtArizaHtml(arizaProps);

  it('is a complete standalone document', () => {
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('@font-face');
    expect(html).toContain('.cert-sheet');
    expect(html).toContain('@page{size:A4;margin:0}');
  });

  it('fetches nothing — the logo travels as a data URI', () => {
    const rest = withoutDataUris(html);
    expect(rest).not.toMatch(/https?:\/\//);
    expect(rest).not.toContain('<link');
    expect(rest).not.toContain('<script');
  });

  it('renders the ariza body', () => {
    expect(html).toContain('Uchtepa tumanlararo sudiga');
    expect(html).toContain('Abdiyeva Muazzamxon Muxsin qizi');
    expect(html).toContain('27 265 002,74');
    expect(html).toContain('S Oʻ R A Y M I Z');
  });
});
