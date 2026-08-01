import { describe, expect, it } from 'vitest';
import React from 'react';
import { createRequire } from 'node:module';
import { PowerOfAttorneyDocument, type PowerOfAttorneyDocumentProps } from './PowerOfAttorneyDocument';

const renderToStaticMarkup: (el: React.ReactElement) => string =
  createRequire(import.meta.url)('react-dom/server').renderToStaticMarkup;

const FIRM = {
  name: '«Prof Collector» МЧЖ',
  letterheadName: '«PROF COLLECTOR» МАСЪУЛИЯТИ ЧЕКЛАНГАН ЖАМИЯТИ',
  directorName: 'Ж.К.Султанов', directorPosition: 'Ижрочи директори',
  address: 'Тошкент шаҳар Мирзо Улуғбек тумани Сайрам 5-тор кўчаси 4-уй',
  stir: '313 090 254', bankAccount: '2020 8000 7074 8190 0001', mfo: '01183', bankName: 'АЖ «ANOR BANK»',
};

function props(over: Partial<PowerOfAttorneyDocumentProps> = {}): PowerOfAttorneyDocumentProps {
  return {
    number: '1/2026', issueDate: new Date(Date.UTC(2026, 5, 1)),
    personFullName: 'HOSILOV SHAXBOZ BAXODIR OʻGʻLI',
    personPinfl: '31234567890123', personPassport: 'AE 1020513',
    poaBankName: 'ANORBANK',
    poaContractDate: new Date(Date.UTC(2026, 5, 17)), poaContractNumber: '1',
    poaValidUntil: new Date(Date.UTC(2026, 7, 31)),
    firm: FIRM,
    ...over,
  };
}

const render = (over?: Partial<PowerOfAttorneyDocumentProps>) =>
  renderToStaticMarkup(React.createElement(PowerOfAttorneyDocument, props(over)));

describe('PowerOfAttorneyDocument', () => {
  it('prints the firm, person, contract and validity', () => {
    const html = render();
    expect(html).toContain('И Ш О Н Ч Н О М А № 1/2026');
    expect(html).toContain('PROF COLLECTOR');                     // firm masthead
    expect(html).toContain('ИНН: 313 090 254');                   // firm rekvizitlar
    expect(html).toContain('HOSILOV SHAXBOZ BAXODIR OʻGʻLI');     // authorised person
    expect(html).toContain('AE 1020513');                         // passport
    expect(html).toContain('17.06.2026 йилда тузилган 1-сонли');  // service contract
    expect(html).toContain('31.08.2026 йилга қадар');             // validity
    expect(html).toContain('Ж.К.Султанов');                       // director signature
    expect(html).toContain('Мажбурий ижро бюроси');               // constant authority text
  });

  it('shows the QR only when a data URL is given', () => {
    expect(render({ qrDataUrl: undefined })).not.toContain('Ҳақиқийлигини');
    expect(render({ qrDataUrl: 'data:image/png;base64,AAAA' })).toContain('Ҳақиқийлигини');
  });
});
