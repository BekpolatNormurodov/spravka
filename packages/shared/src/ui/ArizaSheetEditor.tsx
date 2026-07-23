'use client';

/**
 * Everything around the ariza paper, and nothing on it — the sibling of CertSheetEditor.
 *
 * The sheet itself is CourtArizaDocument, the same component the PDF is printed from, handed a set
 * of edit slots. This file owns the chrome: the PINFL lookup that autofills a repeat debtor, undo,
 * the print-preview toggle, and the save bar. No «Sugʻurta» button (that is the maʼlumotnoma's) and
 * no one-page overflow warning (the ariza is legitimately two pages).
 */

import React, { useMemo, useRef, useState } from 'react';
import { maskPinfl, isValidPinfl } from '../core';
import { CourtArizaDocument } from './CourtArizaDocument';
import type { CertFirm } from './CertificateDocument';
import { asDate, type DraftStore } from './DocumentEdit';
import { arizaEditSlots, arizaDraftProblems, arizaPreviewContracts, type ArizaDraft } from './ArizaEdit';
import type { SaveAction, ClientLookup } from './CertSheetEditor';
import { Ico } from './icons';

export function ArizaSheetEditor({
  firm,
  number,
  store,
  actions,
  requirePinfl,
  onPinflChange,
  lookup,
  title,
  subtitle,
  backHref,
}: {
  firm: CertFirm;
  /** '№…' as it will print, or the peeked one while the counter has not run yet. */
  number: string;
  store: DraftStore<ArizaDraft>;
  actions: SaveAction[];
  /** Whether a missing PINFL blocks the primary action. False while only a draft is being saved. */
  requirePinfl?: boolean;
  onPinflChange?: (v: string) => void;
  lookup?: ClientLookup;
  title: string;
  subtitle?: string;
  /** Where «Orqaga» returns to. The draft is kept in localStorage, so leaving loses nothing. */
  backHref?: string;
}) {
  const { draft, patch, undo, redo, canUndo, canRedo } = store;
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const sheetRef = useRef<HTMLDivElement>(null);

  const problems = useMemo(() => arizaDraftProblems(draft), [draft]);

  // Nothing is marked wrong until the person tries to submit — a blank ariza is entirely unfilled.
  const [showProblems, setShowProblems] = useState(false);
  const bad = useMemo(
    () => new Set(showProblems ? problems.map((p) => p.field) : []),
    [problems, showProblems],
  );
  const pinflBad = bad.has('personPinfl');
  const pinflRef = useRef<HTMLInputElement>(null);

  const focusFirstProblem = () => {
    const first = problems[0];
    if (!first) return;
    // PINFL lives in this bar, not on the paper, so it is not a `data-slot`.
    if (first.field === 'personPinfl') {
      pinflRef.current?.focus();
      pinflRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    const el = sheetRef.current?.querySelector<HTMLElement>(`[data-slot="${first.field}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (el?.firstElementChild as HTMLElement | null)?.focus() ?? el?.focus();
  };

  async function run(a: SaveAction) {
    if (a.requiresValid && problems.length) {
      setShowProblems(true);
      return focusFirstProblem();
    }
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
    () => arizaEditSlots(draft, { patch, undo, redo, invalid: (f) => bad.has(f) }),
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
        {backHref && (
          <a href={backHref} className="btn-ghost shrink-0 px-3 py-2 text-xs" title="Orqaga">
            <Ico.chevronLeft size={16} /> Orqaga
          </a>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold">{title}</h1>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>

        {/* PINFL is not on the paper as an editor — it drives the client lookup and fills the JShShIR
            line. Its own red border and message, right where it is typed. */}
        <div>
          <label
            className={`flex items-center gap-2 rounded-xl border bg-surface px-3 py-2 ${
              pinflBad ? 'border-rose-500/60 ring-2 ring-rose-500/25' : 'border-line'
            }`}
          >
            <span className={`text-xs font-medium ${pinflBad ? 'text-rose-600 dark:text-rose-300' : 'text-muted'}`}>
              PINFL
            </span>
            <input
              ref={pinflRef}
              className="w-[17ch] bg-transparent font-mono text-sm tabular-nums outline-none"
              inputMode="numeric"
              placeholder="12345678901234"
              value={draft.personPinfl}
              aria-label="Qarzdor PINFL"
              aria-invalid={pinflBad}
              aria-describedby={pinflBad ? 'pinfl-err' : undefined}
              onChange={(e) => onPinflChange?.(maskPinfl(e.target.value))}
            />
            <LookupBadge lookup={lookup ?? { state: 'idle' }} pinfl={draft.personPinfl} />
          </label>
          {pinflBad && (
            <p id="pinfl-err" role="alert" className="mt-1 text-[11px] font-medium text-rose-600 dark:text-rose-300">
              {problems.find((p) => p.field === 'personPinfl')?.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => patch({ contracts: [...draft.contracts, { number: '', date: '' }] }, true)}
          className="btn-ghost px-3 py-2 text-xs"
          title="Ariza bir nechta shartnomani qamrab olishi mumkin"
        >
          <Ico.add size={16} /> Shartnoma
        </button>

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
        <CourtArizaDocument
          number={number}
          issueDate={asDate(draft.issueDate)}
          courtName={draft.courtName}
          personFullName={draft.personFullName}
          personPinfl={draft.personPinfl}
          personAddress={draft.personAddress}
          personPhone={draft.personPhone}
          contracts={arizaPreviewContracts(draft)}
          contractType={draft.contractType}
          interestRate={draft.interestRate}
          loanAmount={draft.loanAmount}
          asOfDate={asDate(draft.asOfDate)}
          asOfText={draft.asOfText}
          debtPrincipal={draft.debtPrincipal}
          debtTermInterest={draft.debtTermInterest}
          debtOverduePrincipal={draft.debtOverduePrincipal}
          debtOverdueInterest={draft.debtOverdueInterest}
          debtTotal={draft.debtTotal}
          chamberSignerPosition={draft.chamberSignerPosition}
          chamberSignerName={draft.chamberSignerName}
          chamberExecutorName={draft.chamberExecutorName}
          chamberExecutorPhone={draft.chamberExecutorPhone}
          firm={firm}
          edit={preview ? undefined : edit}
        />
      </div>

      {/* ── Save bar ── */}
      <div className="no-print sticky bottom-0 mt-6 border-t border-line bg-bg/85 py-4 backdrop-blur-xl">
        {err && (
          <p role="alert" className="mb-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-300">
            {err}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {problems[0] && (
            <button
              type="button"
              onClick={() => { setShowProblems(true); focusFirstProblem(); }}
              className="mr-auto text-left text-xs text-muted hover:text-fg"
            >
              Yuborish uchun {problems.length} ta maydon kerak — <span className="underline">birinchisiga oʻtish</span>
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

/* ── Small parts (kept local, like CertSheetEditor's) ───────────────────────────────────────────── */

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
  if (!isValidPinfl(pinfl)) return null;
  if (lookup.state === 'searching') return <span className="text-[11px] text-muted">Qidirilmoqda…</span>;
  if (lookup.state === 'found') {
    return (
      <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        ✓ Mijoz topildi{lookup.previous > 0 ? ` · ${lookup.previous} ta hujjat` : ''}
      </span>
    );
  }
  if (lookup.state === 'new') return <span className="text-[11px] text-muted">Yangi mijoz</span>;
  return null;
}
