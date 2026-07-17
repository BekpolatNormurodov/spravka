import React from 'react';
import { WfAction } from '../core/enums';
import { ACTION_LABELS } from '../core/labels';
import { dmy } from '../core/document';
import { STATUS_DOT } from './tokens';

export interface TimelineAttachment {
  id: string;
  fileName: string;
  mime: string;
  size: number;
}

export interface TimelineEvent {
  id: string;
  action: WfAction;
  note: string | null;
  createdAt: Date;
  actor: { fullName: string };
  attachments?: TimelineAttachment[];
}

/** Colour is never the only cue — every row is already labelled by its action name. */
const TONE: Record<WfAction, string> = {
  [WfAction.SUBMIT]: 'bg-slate-400',
  [WfAction.APPROVE]: 'bg-brand-500',
  [WfAction.RETURN]: 'bg-amber-500',
  [WfAction.SIGN]: 'bg-accent-500',
  [WfAction.DELETE]: 'bg-rose-500',
  [WfAction.RESTORE]: 'bg-violet-500',
};

const KB = 1024;
function fileSize(bytes: number): string {
  if (bytes < KB) return `${bytes} B`;
  if (bytes < KB * KB) return `${Math.round(bytes / KB)} KB`;
  return `${(bytes / KB / KB).toFixed(1)} MB`;
}

const isImage = (mime: string) => mime.startsWith('image/');

/**
 * The ariza's chain: who did what, the message they left, and whatever they attached.
 *
 * A note used to be stored on every workflow event and shown on none of them — the rahbar
 * could not read what the admin wrote when passing the ariza up. All three roles render this
 * same component; the public page must never receive these events.
 */
export function EventTimeline({ events, hrefFor }: { events: TimelineEvent[]; hrefFor: (id: string) => string }) {
  if (!events.length) return <p className="text-muted">Hali harakat yoʻq.</p>;

  return (
    <ol className="space-y-4">
      {events.map((e) => (
        <li key={e.id} className="relative pl-5">
          <span
            aria-hidden
            className={`absolute left-0 top-1.5 h-2 w-2 rounded-full ${TONE[e.action] ?? STATUS_DOT.DRAFT}`}
          />
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{ACTION_LABELS[e.action]}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted">{dmy(e.createdAt)}</span>
          </div>
          <p className="text-xs text-muted">{e.actor.fullName}</p>

          {e.note && (
            <p className="mt-1.5 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg">
              {e.note}
            </p>
          )}

          {!!e.attachments?.length && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {e.attachments.map((a) => (
                <li key={a.id}>
                  <a
                    href={hrefFor(a.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-line p-1.5 pr-2.5 transition-colors hover:bg-surface-2"
                    title={`${a.fileName} · ${fileSize(a.size)}`}
                  >
                    {isImage(a.mime) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={hrefFor(a.id)}
                        alt=""
                        className="h-9 w-9 shrink-0 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-surface-2 text-[10px] font-bold uppercase text-muted">
                        {(a.fileName.split('.').pop() ?? '?').slice(0, 4)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block max-w-[150px] truncate text-xs font-medium">{a.fileName}</span>
                      <span className="block text-[11px] text-muted">{fileSize(a.size)}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
