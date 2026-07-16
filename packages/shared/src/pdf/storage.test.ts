import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { certPdfPath, readPdf, removePdf, resolvePdf, savePdf, sha256, storageRoot } from './storage';

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'spravka-pdf-'));
  process.env.CERT_STORAGE_DIR = dir;
});
afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('storageRoot', () => {
  it('refuses to guess', async () => {
    // A silent fallback would put issued documents somewhere the next deploy wipes.
    const prev = process.env.CERT_STORAGE_DIR;
    delete process.env.CERT_STORAGE_DIR;
    expect(() => storageRoot()).toThrow(/CERT_STORAGE_DIR/);
    process.env.CERT_STORAGE_DIR = prev;
  });
});

describe('certPdfPath', () => {
  it('derives the path from the id alone', () => {
    expect(certPdfPath('4ROAztohkCl8')).toBe('certificates/4ROAztohkCl8.pdf');
    expect(certPdfPath('4g03_NzMd-EN')).toBe('certificates/4g03_NzMd-EN.pdf');
  });

  it('rejects anything that could walk out of the root', () => {
    for (const bad of ['../etc/passwd', 'a/b', 'a\\b', '..', 'x.pdf', '']) {
      expect(() => certPdfPath(bad)).toThrow(/unsafe certificate id/);
    }
  });
});

describe('resolvePdf', () => {
  it('keeps the path inside the storage root', () => {
    expect(resolvePdf('certificates/x.pdf')).toBe(path.resolve(dir, 'certificates/x.pdf'));
    expect(() => resolvePdf('../../etc/passwd')).toThrow(/escapes the storage root/);
  });
});

describe('save / read / remove', () => {
  const buf = Buffer.from('%PDF-1.4 ...bytes...');

  it('round-trips the exact bytes and reports their digest', async () => {
    const { pdfPath, pdfSha256 } = await savePdf('4ROAztohkCl8', buf);
    expect(pdfPath).toBe('certificates/4ROAztohkCl8.pdf');
    expect(pdfSha256).toBe(sha256(buf));

    const back = await readPdf(pdfPath);
    expect(back).not.toBeNull();
    // Byte-identical, not merely equal-looking: this file is the issued document.
    expect(back!.equals(buf)).toBe(true);
  });

  it('reports an absent file as absence, not failure', async () => {
    // ensure() leans on this to re-freeze a document whose file was lost, rather than 500.
    expect(await readPdf('certificates/nope.pdf')).toBeNull();
  });

  it('removes, and removing twice is not an error', async () => {
    await savePdf('gone', buf);
    await removePdf('certificates/gone.pdf');
    expect(await readPdf('certificates/gone.pdf')).toBeNull();
    await expect(removePdf('certificates/gone.pdf')).resolves.toBeUndefined();
  });
});
