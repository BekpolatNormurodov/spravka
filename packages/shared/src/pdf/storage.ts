import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

const SUBDIR = 'certificates';

/**
 * Where signed documents live. Deliberately has no default: a silent fallback to a temp dir or
 * the repo would mean the files vanish on the next deploy, and these are legal documents — a
 * lost one cannot be re-made, because a re-render is a *different* file.
 */
export function storageRoot(): string {
  const dir = process.env.CERT_STORAGE_DIR;
  if (!dir) throw new Error('CERT_STORAGE_DIR is not set — signed documents have nowhere to live');
  return dir;
}

/** The relative path recorded in `Certificate.pdfPath`. */
export function certPdfPath(id: string): string {
  // Certificate ids are nanoid-shaped. Anything else is either a bug or an attempt to walk out
  // of the storage root, and both should stop here rather than reach the filesystem.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`unsafe certificate id: ${JSON.stringify(id)}`);
  return `${SUBDIR}/${id}.pdf`;
}

/**
 * Resolve a stored relative path to an absolute one, refusing anything outside the root.
 * Not pdf-specific — workflow attachments share this root, and this guard is the only thing
 * standing between a stored path and the rest of the disk, so it exists once.
 */
export function resolveInStorage(relPath: string): string {
  const root = storageRoot();
  const abs = path.resolve(root, relPath);
  const bounded = path.resolve(root) + path.sep;
  if (!abs.startsWith(bounded)) throw new Error(`path escapes the storage root: ${relPath}`);
  return abs;
}

/** @deprecated Name says pdf; the guard is general. Use resolveInStorage. */
export const resolvePdf = resolveInStorage;

export function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

/** Write the document and report what was written. */
export async function savePdf(id: string, buf: Buffer): Promise<{ pdfPath: string; pdfSha256: string }> {
  const relPath = certPdfPath(id);
  const abs = resolvePdf(relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return { pdfPath: relPath, pdfSha256: sha256(buf) };
}

/** The stored bytes, or null when the file is not there. Absence is an answer, not a failure. */
export async function readPdf(relPath: string): Promise<Buffer | null> {
  try {
    return await readFile(resolvePdf(relPath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

/** Best-effort cleanup: used to undo a write whose transaction then failed. */
export async function removePdf(relPath: string): Promise<void> {
  try {
    await unlink(resolvePdf(relPath));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
