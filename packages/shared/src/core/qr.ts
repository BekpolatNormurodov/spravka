// Node-only (qrcode). Exposed on the `@spravka/shared/qr` subpath so it never enters an
// edge-runtime bundle (middleware). Edge-safe logic stays on `@spravka/shared/core`.
import QRCode from 'qrcode';

/** Public verification URL for a certificate id. */
export function certPublicUrl(id: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_PUBLIC_URL ?? 'http://localhost:5100';
  return `${base.replace(/\/$/, '')}/m/${id}`;
}

/**
 * Render a QR PNG data-URL for the certificate's public URL.
 *
 * 512px: the document prints this at 22mm — ~260px at 300dpi, ~520px at 600dpi — and a code
 * resampled up from 240 loses its module edges on paper. Level Q keeps it readable when a
 * muhr or a crease covers part of it; a printed page has no second chance to reload.
 */
export async function certQrDataUrl(id: string, baseUrl?: string, width = 512): Promise<string> {
  return QRCode.toDataURL(certPublicUrl(id, baseUrl), {
    width,
    margin: 1,
    errorCorrectionLevel: 'Q',
    color: { dark: '#0f172a', light: '#ffffff' },
  });
}
