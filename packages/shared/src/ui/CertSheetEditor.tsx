'use client';

/**
 * Everything around the paper, and nothing on it.
 *
 * The sheet itself is CertificateDocument — the same component the PDF is printed from — handed a
 * set of edit slots. This file owns the chrome: the PINFL lookup that never prints, undo, the
 * print-preview toggle, the overflow warning and the save bar. Shared by the yurist writing a new
 * ariza and the admin correcting one, so the two cannot drift into different documents.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { maskPinfl, isValidPinfl } from '../core';
import { CertificateDocument, type CertFirm } from './CertificateDocument';
import {
  asDate, certificateEditSlots, draftProblems, previewContracts,
  type CertDraftStore,
} from './DocumentEdit';
import { Ico } from './icons';

export type ClientLookup =
  | { state: 'idle' }
  | { state: 'searching' }
  | { state: 'found'; previous: number }
  | { state: 'new' };

export interface SaveAction {
  label: string;
  busyLabel: string;
  /** Rejects with a message the person can act on, or resolves when the row landed. */
  run: () => Promise<void>;
  primary?: boolean;
  /** Draft saves are allowed to be incomplete; a submit is not. */
  requiresValid?: boolean;
}

export function CertSheetEditor({
  firm,
  number,
  store,
  actions,
  pinfl,
  onPinflChange,
  lookup,
  title,
  subtitle,
}: {
  firm: CertFirm;
  /** '№…' as it will print, or a placeholder while the counter has not run yet. */
  number: string;
  store: CertDraftStore;
  actions: SaveAction[];
  /** Absent for the admin: the client is already linked and the lookup would only confuse. */
  pinfl?: boolean;
  onPinflChange?: (v: string) => void;
  lookup?: ClientLookup;
  title: string;
  subtitle?: string;
}) {
  const { draft, patch, undo, redo, canUndo, canRedo } = store;
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const [overflows, setOverflows] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const problems = useMemo(() => draftProblems(draft, { pinfl: !!pinfl }), [draft, pinfl]);
  const bad = useMemo(() => new Set(problems.map((p) => p.field)), [problems]);

  /*
    A second page is a thing to notice while it can still be fixed, not after signing.

    Measured against A4 rather than against the element's own scrollHeight: `.cert-sheet` has a
    min-height and no max, so it grows instead of scrolling and the two are always equal. 297mm at
    the 96dpi CSS uses for physical units is ~1122.5px; the tolerance covers sub-pixel layout.
  */
  useEffect(() => {
    const el = sheetRef.current?.querySelector('.cert-sheet') as HTMLElement | null;
    if (!el) return;
    const A4_PX = (297 / 25.4) * 96;
    const check = () => setOverflows(el.getBoundingClientRect().height > A4_PX + 4);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [draft]);

  const focusFirstProblem = () => {
    const first = problems[0];
    if (!first) return;
    const el = sheetRef.current?.querySelector<HTMLElement>(`[data-slot="${first.field}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus();
  };

  async function run(a: SaveAction) {
    if (a.requiresValid && problems.length) return focusFirstProblem();
    setBusy(a.label);
    setErr('');
    try {
      await a.run();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Xatolik yuz berdi');
      setBusy('');
    }
  }

  const edit = useMemo(
    () => certificateEditSlots(draft, { patch, undo, redo, invalid: (f) => bad.has(f) }),
    [draft, patch, undo, redo, bad],
  );

  return (
    <div className="cert-editor">
      {store.recovered && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <Ico.info size={18} />
          <span className="flex-1">Saqlanmagan qoralama topildi — tiklansinmi?</span>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={store.restore}>Tiklash</button>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={store.dismissRecovered}>Kerak emas</button>
        </div>
      )}

      {/* ── Bar above the paper. Everything here is something that never prints. ── */}
      <div className="no-print mb-5 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>

        {pinfl && (
          <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2">
            <span className="text-xs font-medium text-muted">PINFL</span>
            <input
              className="w-[13ch] bg-transparent font-mono text-sm tabular-nums outline-none"
              inputMode="numeric"
              placeholder="12345678901234"
              value={draft.personPinfl}
              aria-label="Mijoz PINFL"
              aria-invalid={bad.has('personPinfl')}
              onChange={(e) => onPinflChange?.(maskPinfl(e.target.value))}
            />
            <LookupBadge lookup={lookup ?? { state: 'idle' }} pinfl={draft.personPinfl} />
          </label>
        )}

        <div className="flex items-center gap-1 rounded-xl border border-line bg-surface p-1">
          <IconBtn onClick={undo} disabled={!canUndo} label="Orqaga qaytarish (Ctrl+Z)"><Ico.undo size={16} /></IconBtn>
          <IconBtn onClick={redo} disabled={!canRedo} label="Qaytadan (Ctrl+Shift+Z)"><Ico.redo size={16} /></IconBtn>
        </div>

        <button
          type="button"
          onClick={() => setPreview((v) => !v)}
          className="btn-ghost px-3 py-2 text-xs"
          aria-pressed={preview}
          title="Hujjat qogʻozda qanday chiqishini koʻrsatadi"
        >
          <Ico.eye size={16} />
          {preview ? 'Tahrirga qaytish' : 'Chop etish koʻrinishi'}
        </button>
      </div>

      {/* ── The paper ── */}
      <div ref={sheetRef} className={`cert-frame cert-paper ${preview ? '' : 'cert-editing'}`}>
        <CertificateDocument
          number={number}
          issueDate={asDate(draft.issueDate)}
          personFullName={draft.personFullName}
          personPassport={draft.personPassport}
          passportIssuedBy={draft.passportIssuedBy || null}
          passportIssuedAt={draft.passportIssuedAt ? asDate(draft.passportIssuedAt) : null}
          contracts={previewContracts(draft)}
          contractType={draft.contractType}
          loanAmount={draft.loanAmount}
          asOfDate={asDate(draft.asOfDate)}
          firm={firm}
          edit={preview ? undefined : edit}
        />
      </div>

      {overflows && (
        <p className="no-print mt-3 text-center text-xs text-amber-600 dark:text-amber-400">
          <Ico.info size={14} /> Matn bir betga sigʻmayapti — hujjat ikkinchi betga tushadi.
        </p>
      )}

      {/* ── Save bar ── */}
      <div className="no-print sticky bottom-0 mt-6 border-t border-line bg-bg/85 py-4 backdrop-blur-xl">
        {err && (
          <p role="alert" className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-300">
            {err}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {problems[0] && (
            <button type="button" onClick={focusFirstProblem} className="mr-auto text-left text-xs text-muted hover:text-fg">
              {problems.length} ta maydon toʻldirilmagan — <span className="underline">birinchisiga oʻtish</span>
              <span className="block text-[11px] opacity-70">{problems[0].message}</span>
            </button>
          )}
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => run(a)}
              disabled={!!busy}
              className={a.primary ? 'btn-primary' : 'btn-ghost'}
            >
              {a.primary && <Ico.check size={18} />}
              {busy === a.label ? a.busyLabel : a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Small parts ────────────────────────────────────────────────────────────────────────────── */

function IconBtn({
  onClick, disabled, label, children,
}: { onClick: () => void; disabled?: boolean; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="cursor-pointer rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function LookupBadge({ lookup, pinfl }: { lookup: ClientLookup; pinfl: string }) {
  if (!isValidPinfl(pinfl)) return <span className="text-[11px] text-muted">14 ta raqam</span>;
  if (lookup.state === 'searching') return <span className="text-[11px] text-muted">Qidirilmoqda…</span>;
  if (lookup.state === 'found') {
    return (
      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        ✓ Mijoz topildi{lookup.previous > 0 ? ` · ${lookup.previous} ta ariza` : ''}
      </span>
    );
  }
  if (lookup.state === 'new') return <span className="text-[11px] text-muted">Yangi mijoz</span>;
  return null;
}

