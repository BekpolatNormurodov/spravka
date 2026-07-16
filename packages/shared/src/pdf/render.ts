import puppeteer, { type Browser } from 'puppeteer';

let browserPromise: Promise<Browser> | null = null;

/**
 * One Chromium for the process, reused. Launching costs ~1s; doing it per document is the
 * difference between an Imzolash click that feels instant and one that feels broken.
 */
function browser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        // The host runs this as a systemd service; Chromium's sandbox needs privileges it will
        // not have there. The HTML is ours and contains no scripts — React has already escaped
        // every value in it — so there is no untrusted code for the sandbox to contain.
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      })
      // A failed launch must not poison every later render with the same rejected promise.
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

/**
 * Render a standalone HTML document to A4 PDF bytes.
 *
 * Throws rather than returning something broken: a maʼlumotnoma that failed to render must fail
 * the signing outright, never be stored as an unreadable file that only surfaces years later.
 */
export async function renderPdf(html: string): Promise<Buffer> {
  const page = await (await browser()).newPage();
  try {
    await page.setContent(html, { waitUntil: 'load' });

    // Without this the page can paint before the inlined @font-face rules are parsed, and the
    // PDF freezes a fallback font — the exact failure the fonts are bundled to prevent.
    await page.evaluate(() => document.fonts.ready);

    const out = await page.pdf({
      format: 'A4',
      printBackground: true,
      // The sheet already carries the .docx margins; a second set here would inset them twice.
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    const buf = Buffer.from(out);
    if (buf.length === 0) throw new Error('PDF render produced no bytes');
    if (buf.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new Error('PDF render produced something that is not a PDF');
    }
    return buf;
  } finally {
    await page.close();
  }
}

/** Shut the shared browser down. For tests and graceful exit; renders relaunch on demand. */
export async function closeRenderer(): Promise<void> {
  const p = browserPromise;
  browserPromise = null;
  if (p) await (await p).close();
}
