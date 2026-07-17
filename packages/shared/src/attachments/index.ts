// Node-only (fs). Exposed on the `@spravka/shared/attachments` subpath so it never enters an
// edge-runtime bundle. The pure rules are re-exported here for the routes' convenience.
export { attachmentPath, saveAttachment, readAttachment, removeAttachment } from './storage';
export { readActionRequest, discard, cleanName } from './intake';
export type { Intake, IntakeFile } from './intake';
export { serveAttachment } from './serve';
export type { ServeRow } from './serve';
export { attachmentError, safeExt, isImageMime, ACCEPT_ATTR, MAX_FILE_BYTES, MAX_PER_ARIZA } from './rules';
