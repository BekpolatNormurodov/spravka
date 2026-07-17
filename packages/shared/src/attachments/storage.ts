// Node-only (fs). Reached through the `@spravka/shared/attachments` subpath.
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveInStorage, sha256 } from '../pdf/storage';
import { safeExt } from './rules';

const SUBDIR = 'attachments';

/**
 * Where an attachment lives. The id is ours (cuid) and the extension comes from the mime type,
 * so nothing in this path is chosen by the uploader — the original filename is kept in the
 * database for display only.
 */
export function attachmentPath(id: string, mime: string, fileName: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw new Error(`unsafe attachment id: ${JSON.stringify(id)}`);
  return `${SUBDIR}/${id}.${safeExt(mime, fileName)}`;
}

export async function saveAttachment(
  id: string,
  mime: string,
  fileName: string,
  buf: Buffer,
): Promise<{ path: string; sha256: string }> {
  const relPath = attachmentPath(id, mime, fileName);
  const abs = resolveInStorage(relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return { path: relPath, sha256: sha256(buf) };
}

/** Null when the row points at a file that is no longer there. */
export async function readAttachment(relPath: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveInStorage(relPath));
  } catch {
    return null;
  }
}

export async function removeAttachment(relPath: string): Promise<void> {
  await unlink(resolveInStorage(relPath)).catch(() => {});
}
