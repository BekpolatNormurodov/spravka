import React from 'react';
import { createRequire } from 'node:module';
import { CertificateDocument, type CertificateDocumentProps } from '../ui/CertificateDocument';
import { CourtArizaDocument, type CourtArizaDocumentProps } from '../ui/CourtArizaDocument';
import { fontFaceCss } from './fonts';

/**
 * `react-dom/server`, loaded at runtime rather than imported.
 *
 * Next's App Router refuses to compile any module that imports react-dom/server — a guard against
 * accidentally server-rendering components inside RSC. Here it is a false positive: we are not
 * rendering a page, we are generating a document artifact that Chromium then prints. Going
 * through createRequire keeps the module out of webpack's static analysis while still resolving
 * normally under Node.
 */
const renderToStaticMarkup: (el: React.ReactElement) => string =
  createRequire(import.meta.url)('react-dom/server').renderToStaticMarkup;

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
function standaloneHtml(title: string, body: string): string {
  return (
    `<!doctype html><html lang="uz"><head><meta charset="utf-8">` +
    `<title>${title}</title>` +
    `<style>${fontFaceCss()}${SHEET_CSS}</style>` +
    `</head><body>${body}</body></html>`
  );
}

export function certificateHtml(props: CertificateDocumentProps): string {
  return standaloneHtml(props.number, renderToStaticMarkup(<CertificateDocument {...props} />));
}

/** The «Savdo-sanoat palatasiga ariza», same standalone contract as {@link certificateHtml}. */
export function courtArizaHtml(props: CourtArizaDocumentProps): string {
  return standaloneHtml(props.number, renderToStaticMarkup(<CourtArizaDocument {...props} />));
}
