import type { CertContract, Certificate, Firm, Prisma } from '@prisma/client';
import { prisma } from '../db/index';
import { CertStatus } from '../core/enums';
import { certQrDataUrl } from '../core/qr';
import { firmForDocument } from '../ui/CertificateDocument';
import { certificateHtml } from './html';
import { renderPdf } from './render';
import { readPdf, savePdf } from './storage';

/** Everything the document prints: the row, its firm, and its contracts in print order. */
export type CertificateWithFirm = Certificate & { firm: Firm; contracts: CertContract[] };

/**
 * The join every caller needs to render. Exported so a route cannot accidentally load a
 * certificate without its contracts and print a document that is missing one.
 */
export const CERT_PDF_INCLUDE = {
  firm: true,
  contracts: { orderBy: { order: 'asc' } },
} satisfies Prisma.CertificateInclude;

/** Render the document exactly as it is issued, QR included. */
export async function buildCertificatePdf(cert: CertificateWithFirm): Promise<Buffer> {
  const qrDataUrl = await certQrDataUrl(cert.id);
  return renderPdf(
    certificateHtml({
      number: cert.number,
      issueDate: cert.issueDate,
      personFullName: cert.personFullName,
      // The column is nullable now (an ariza debtor has no passport), but a maʼlumotnoma always
      // carries one — validation requires it. '' is a defensive floor, never reached in practice.
      personPassport: cert.personPassport ?? '',
      passportIssuedBy: cert.passportIssuedBy,
      passportIssuedAt: cert.passportIssuedAt,
      contracts: cert.contracts,
      contractType: cert.contractType,
      loanAmount: cert.loanAmount.toString(),
      asOfDate: cert.asOfDate,
      // The phrase as it was written, not a re-render of the date. Leaving this out would freeze a
      // PDF that words its «... ҳолатида» differently from the document on screen — the one kind
      // of divergence this whole pipeline exists to prevent.
      asOfText: cert.asOfText,
      infoRecipient: cert.infoRecipient,
      firm: firmForDocument(cert.firm, cert.firmSnapshot),
      qrDataUrl,
    }),
  );
}

/**
 * The stored document for a signed certificate, rendering and freezing it on first ask.
 *
 * Covers the rows signed before this existed, and any row whose file went missing. Renders from
 * `firmSnapshot`, so a document issued long ago still comes out with the rekvizitlar it was
 * issued under, not today's.
 *
 * Returns null when there is nothing to serve — unknown, deleted, or not signed. Callers turn
 * that into a 404; an unsigned ariza has no issued document to freeze. The number comes back too
 * so a caller can name the file without a second query.
 */
export async function ensureCertificatePdf(id: string): Promise<{ pdf: Buffer; number: string } | null> {
  const cert = await prisma.certificate.findUnique({ where: { id }, include: CERT_PDF_INCLUDE });
  if (!cert || cert.deletedAt || cert.status !== CertStatus.SIGNED) return null;

  if (cert.pdfPath) {
    const stored = await readPdf(cert.pdfPath);
    if (stored) return { pdf: stored, number: cert.number };
    // The row points at a file that is gone. Fall through and re-freeze rather than 500 — but
    // this means a backup was lost, and the new bytes will not be the issued ones byte-for-byte.
  }

  const pdf = await buildCertificatePdf(cert);
  const { pdfPath, pdfSha256 } = await savePdf(cert.id, pdf);
  await prisma.certificate.update({ where: { id: cert.id }, data: { pdfPath, pdfSha256 } });
  return { pdf, number: cert.number };
}
