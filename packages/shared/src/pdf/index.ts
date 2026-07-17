// Node-only (puppeteer + fs). Exposed on the `@spravka/shared/pdf` subpath so it never enters an
// edge-runtime or browser bundle. Edge-safe logic stays on `@spravka/shared/core`.
export { buildCertificatePdf, ensureCertificatePdf, CERT_PDF_INCLUDE, type CertificateWithFirm } from './ensure';
export { certificateHtml } from './html';
export { renderPdf, closeRenderer } from './render';
export { certPdfPath, readPdf, removePdf, resolvePdf, resolveInStorage, savePdf, sha256, storageRoot } from './storage';
export { fontFaceCss, SUBSTITUTED_FAMILIES } from './fonts';
