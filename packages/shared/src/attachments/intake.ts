// Node-only. Turns an action request (JSON or multipart) into a validated note + files on disk.
import { randomUUID } from 'node:crypto';
import { attachmentError, MAX_PER_ARIZA } from './rules';
import { saveAttachment, removeAttachment } from './storage';

export interface IntakeFile {
  id: string;
  fileName: string;
  path: string;
  mime: string;
  size: number;
  sha256: string;
}

export interface Intake {
  note: string | null;
  action: string;
  files: IntakeFile[];
}

/** Control chars, plus the ones that mean something to a filesystem or a header. */
const UNSAFE_NAME = new RegExp('[\\u0000-\\u001f"*:<>?|]', 'g');

/**
 * Filenames are only displayed and offered as a download name — never used to build a path —
 * but they still go back out to other users, so drop directory parts and the characters that
 * make a name mean something to a filesystem or a Content-Disposition header.
 */
export function cleanName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const stripped = base.replace(UNSAFE_NAME, '').trim();
  return stripped.slice(0, 120) || 'fayl';
}

/**
 * Read an action request that may be JSON or multipart. Files are written to disk here, before
 * the caller opens its transaction — writing inside one would hold row locks for the length of
 * the IO. If the transaction then fails the caller must call `discard`, or the bytes are
 * orphaned.
 */
export async function readActionRequest(
  req: Request,
  opts: { existingCount?: number } = {},
): Promise<{ error: string } | Intake> {
  const type = req.headers.get('content-type') ?? '';

  if (!type.includes('multipart/form-data')) {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      action: typeof b.action === 'string' ? b.action : '',
      note: typeof b.note === 'string' && b.note.trim() ? b.note.trim() : null,
      files: [],
    };
  }

  const form = await req.formData();
  const action = String(form.get('action') ?? '');
  const rawNote = String(form.get('note') ?? '').trim();
  const uploads = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0);

  const total = (opts.existingCount ?? 0) + uploads.length;
  if (total > MAX_PER_ARIZA) {
    return { error: `Arizaga eng koʻpi ${MAX_PER_ARIZA} ta fayl biriktirish mumkin (hozir ${total} ta)` };
  }

  for (const f of uploads) {
    const bad = attachmentError({ name: f.name, type: f.type, size: f.size });
    if (bad) return { error: bad };
  }

  const files: IntakeFile[] = [];
  try {
    for (const f of uploads) {
      const id = randomUUID().replace(/-/g, '');
      const buf = Buffer.from(await f.arrayBuffer());
      const saved = await saveAttachment(id, f.type, f.name, buf);
      files.push({
        id,
        fileName: cleanName(f.name),
        path: saved.path,
        mime: f.type,
        size: buf.byteLength,
        sha256: saved.sha256,
      });
    }
  } catch (err) {
    await discard(files);
    throw err;
  }

  return { action, note: rawNote || null, files };
}

/** Remove the files an intake wrote when its transaction did not commit. */
export async function discard(files: IntakeFile[]): Promise<void> {
  await Promise.all(files.map((f) => removeAttachment(f.path)));
}
