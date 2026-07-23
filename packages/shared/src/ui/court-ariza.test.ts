import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRequire } from 'node:module';
import { CourtArizaDocument, type CourtArizaDocumentProps } from './CourtArizaDocument';

const renderToStaticMarkup: (el: React.ReactElement) => string =
  createRequire(import.meta.url)('react-dom/server').renderToStaticMarkup;

const FIRM = {
  name: '«BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI» МЧЖ',
  // The Latin letterhead form — this is what the ariza prints, not the Cyrillic body name.
  letterheadName: '“BRIGHT FUTURE FINANCING MIKROMOLIYA TASHKILOTI” MMT MCHJ',
  directorName: 'A.A.', directorPosition: 'Direktor',
  address: 'Toshkent shahar, Olmazor tumani, Guruchariq MFY, Sagʻbon koʻchasi 30 berk, 7/1-uy',
  stir: '311 976 765', bankAccount: '20216000207212842001', mfo: '01183',
};

function arizaProps(over: Partial<CourtArizaDocumentProps> = {}): CourtArizaDocumentProps {
  return {
    number: '0001/09-02', issueDate: new Date(Date.UTC(2026, 6, 15)),
    courtName: 'Fuqarolik ishlari boʻyicha Uchtepa tumanlararo sudiga',
    personFullName: 'Abdiyeva Muazzamxon Muxsin qizi',
    personPinfl: '61011006920020',
    personAddress: 'Fargʻona viloyati, Buvayda tumani, Buvayda MFY',
    personPhone: '998952962728',
    contracts: [
      { number: '22548', date: new Date(Date.UTC(2026, 3, 14)) },
      { number: '58389', date: new Date(Date.UTC(2026, 3, 27)) },
    ],
    contractType: 'ONLAYN', interestRate: '54', loanAmount: '24900000',
    asOfDate: new Date(Date.UTC(2026, 6, 15)), asOfText: '2026 yil 15 iyul',
    debtPrincipal: '24318882.63', debtTermInterest: '143914.49',
    debtOverduePrincipal: '577575.43', debtOverdueInterest: '2224630.19', debtTotal: '27265002.74',
    chamberSignerPosition: 'Boshqarma boshligʻi oʻrinbosari', chamberSignerName: 'B.Babamuradov',
    chamberExecutorName: 'B.Fayziyev', chamberExecutorPhone: '+99895-144-24-00',
    firm: FIRM,
    ...over,
  };
}

const render = (over?: Partial<CourtArizaDocumentProps>) =>
  renderToStaticMarkup(React.createElement(CourtArizaDocument, arizaProps(over)));

describe('CourtArizaDocument', () => {
  it('prints the debtor, court, firm and debt figures', () => {
    const html = render();
    expect(html).toContain('Uchtepa tumanlararo sudiga');
    expect(html).toContain('Abdiyeva Muazzamxon Muxsin qizi');
    expect(html).toContain('61011006920020');
    expect(html).toContain('MMT MCHJ');            // firm via the Latin letterheadName
    expect(html).toContain('14.04.2026-yildagi 22548-sonli');
    expect(html).toContain('24 318 882,63');       // decimal money
    expect(html).toContain('27 265 002,74');       // jami
    expect(html).toContain('A R I Z A');
    expect(html).toContain('S Oʻ R A Y M I Z');
    expect(html).toContain('54% ustama haq');
  });

  it('is Latin — no Cyrillic maʼlumotnoma sentence leaks in', () => {
    const html = render();
    expect(html).not.toContain('МАЪЛУМОТНОМА');
    expect(html).not.toContain('қарздорлиги мавжуд эмас');
  });

  it('falls back to the long-form date when asOfText is empty', () => {
    const html = render({ asOfText: '' });
    expect(html).toContain('2026 yil 15 iyul');
  });

  it('shows the QR only when a data URL is given', () => {
    expect(render({ qrDataUrl: undefined })).not.toContain('QR кодни сканерланг');
    expect(render({ qrDataUrl: 'data:image/png;base64,AAAA' })).toContain('QR кодни сканерланг');
  });
});
