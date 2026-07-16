import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CertificateDocument, type CertificateDocumentProps } from '../ui/CertificateDocument';
import { fontFaceCss } from './fonts';

/**
 * The sheet geometry, copied from `ui/globals.css`. Only `.cert-sheet` is needed: everything
 * else in CertificateDocument is inline styles, so no Tailwind build has to run to print a
 * document. The one deliberate difference is `margin: 0` — globals.css centres the sheet inside
 * a scrolling page, but here the sheet *is* the page.
 */
const SHEET_CSS = `
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff}
.cert-sheet{
  width:210mm;min-height:297mm;
  padding:20mm 15mm 20mm 30mm;
  box-sizing:border-box;background:#fff;color:#000;margin:0;
}
`;

/**
 * A complete, standalone HTML document for one maʼlumotnoma.
 *
 * Standalone is the requirement, not a nicety: this is handed to Chromium via `setContent`, and
 * anything it had to fetch — a font, a stylesheet — would make a signed document depend on the
 * network being up at that moment, and fail by silently looking wrong rather than by erroring.
 */
export function certificateHtml(props: CertificateDocumentProps): string {
  const body = renderToStaticMarkup(<CertificateDocument {...props} />);
  return (
    `<!doctype html><html lang="uz"><head><meta charset="utf-8">` +
    `<title>${props.number}</title>` +
    `<style>${fontFaceCss()}${SHEET_CSS}</style>` +
    `</head><body>${body}</body></html>`
  );
}
