import { ensureCertificatePdf } from '@spravka/shared/pdf';

export const dynamic = 'force-dynamic';

/**
 * The issued maʼlumotnoma itself. Same visibility rule as the page next to it: only a signed,
 * undeleted certificate has a document to hand out.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const found = await ensureCertificatePdf(params.id).catch((err) => {
    console.error('[m/pdf] could not produce the document', err);
    return null;
  });
  if (!found) return new Response('Maʼlumotnoma topilmadi', { status: 404 });

  // The number carries a slash ('26062026/01'), which a filename cannot.
  const filename = `malumotnoma-${found.number.replace(/\//g, '-')}.pdf`;
  return new Response(new Uint8Array(found.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(found.pdf.length),
      'Content-Disposition': `inline; filename="${filename}"`,
      // Frozen bytes: once issued they never change, so let anything downstream keep them.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
