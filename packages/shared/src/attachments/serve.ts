// Node-only. The one implementation each internal app's attachment route delegates to.
import { readAttachment } from './storage';
import { isImageMime } from './rules';

export interface ServeRow {
  fileName: string;
  path: string;
  mime: string;
  size: number;
}

/**
 * Stream an attachment back to a signed-in user.
 *
 * `inline` only for images — anything else downloads. A PDF or an Office file rendered inline
 * runs in this origin, and these files came from a user; the allowlist already refuses SVG and
 * HTML, and this is the second half of that same argument. Attachments are internal: the
 * caller is responsible for having checked the session, and the public app has no such route.
 */
export async function serveAttachment(row: ServeRow | null): Promise<Response> {
  if (!row) return new Response('Topilmadi', { status: 404 });

  const buf = await readAttachment(row.path);
  if (!buf) return new Response('Fayl topilmadi', { status: 404 });

  const disposition = isImageMime(row.mime) ? 'inline' : 'attachment';
  // RFC 5987 — the name may be Cyrillic, which a bare filename= cannot carry.
  const encoded = encodeURIComponent(row.fileName);

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': row.mime,
      'Content-Length': String(buf.byteLength),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encoded}`,
      'Content-Security-Policy': "default-src 'none'; img-src 'self'; sandbox",
      'X-Content-Type-Options': 'nosniff',
      // Internal document — never cached by a proxy on the way.
      'Cache-Control': 'private, max-age=0, no-store',
    },
  });
}
