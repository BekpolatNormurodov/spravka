'use client';

/**
 * The pieces that make a maʼlumotnoma editable where it prints.
 *
 * Two kinds of slot, because the document holds two kinds of value:
 *
 *   EditableText   long values that sit inside a justified paragraph and must wrap and re-flow
 *                  exactly as the printed text does — so they are real text nodes
 *                  (contenteditable), not inputs overlaid on the page.
 *   EditableValue  short masked atoms (passport, dates, sums) where a mask and a date picker
 *                  matter more than reflow — a span that becomes an auto-width input on click.
 *
 * Nothing here is imported by CertificateDocument. It receives these through render props, so
 * @spravka/shared/pdf can keep rendering the same component under Node without dragging a browser
 * bundle into the PDF path.
 */

import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import {
  dmy, formatSum, maskAmount, maskPassport, unmaskAmount, uzLongDate, type DocContract,
} from '../core';
import type { CertificateEdit } from './CertificateDocument';
import { DatePicker } from './DatePicker';
import { Ico } from './icons';

/* ── Draft state, history and persistence ───────────────────────────────────────────────────── */

/** The editable content of one maʼlumotnoma. Dates stay ISO strings until the API parses them. */
export interface CertDraft {
  personPinfl: string;
  personFullName: string;
  personPassport: string;
  passportIssuedBy: string;
  passportIssuedAt: string;
  contracts: { number: string; date: string }[];
  contractType: string;
  loanAmount: string;
  asOfDate: string;
  issueDate: string;
}

/** How long typing has to stop before it becomes one undo step. */
const QUIET_MS = 400;
const HISTORY_MAX = 50;

export interface DraftHistory {
  past: CertDraft[];
  present: CertDraft;
  future: CertDraft[];
  /** The last value pushed into history. Differs from `present` mid-keystroke. */
  committed: CertDraft;
}

/** Starting history for a draft — exported so the reducer can be exercised without React. */
export const initialHistory = (d: CertDraft): DraftHistory => ({
  past: [], present: d, future: [], committed: d,
});

export type DraftAction =
  | { type: 'set'; value: CertDraft }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: CertDraft };

/**
 * One history for the whole draft rather than one per field.
 *
 * Per-field history is what the browser gives away for free and it is wrong here: it cannot see a
 * contract row being added, and Ctrl+Z lands in whichever field happens to hold focus rather than
 * undoing the last thing the person actually did.
 */
export function reduceDraft(s: DraftHistory, a: DraftAction): DraftHistory {
  switch (a.type) {
    case 'set':
      return { ...s, present: a.value, future: [] };

    case 'commit':
      if (s.present === s.committed) return s;
      return {
        ...s,
        past: [...s.past, s.committed].slice(-HISTORY_MAX),
        committed: s.present,
      };

    case 'undo': {
      // Typing that has not settled into history yet is still a step the person expects back.
      const base: DraftHistory =
        s.present === s.committed
          ? s
          : { ...s, past: [...s.past, s.committed].slice(-HISTORY_MAX), committed: s.present };
      const prev = base.past[base.past.length - 1];
      if (!prev) return base;
      return {
        past: base.past.slice(0, -1),
        present: prev,
        committed: prev,
        future: [base.committed, ...base.future],
      };
    }

    case 'redo': {
      const [next, ...rest] = s.future;
      if (!next) return s;
      return { past: [...s.past, s.committed].slice(-HISTORY_MAX), present: next, committed: next, future: rest };
    }

    case 'reset':
      return { past: [], present: a.value, future: [], committed: a.value };
  }
}

export interface CertDraftStore {
  draft: CertDraft;
  /** Patch one or more fields. `immediate` skips coalescing — use it for structural changes. */
  patch: (p: Partial<CertDraft>, immediate?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** A stored draft was found that differs from what the server gave us. */
  recovered: CertDraft | null;
  restore: () => void;
  dismissRecovered: () => void;
  /** Drop the stored copy — call after a save lands. */
  clearStored: () => void;
}

/**
 * Draft state, undo history and browser-local persistence.
 *
 * Persistence is localStorage and nothing else on purpose: `nextCertNumber` bumps an atomic
 * counter that is never reused, so creating a row to autosave into would burn an official
 * маълумотнома number on every abandoned attempt.
 */
export function useCertDraft(initial: CertDraft, storageKey: string | null): CertDraftStore {
  const [h, dispatch] = useReducer(reduceDraft, initialHistory(initial));

  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [recovered, setRecovered] = useState<CertDraft | null>(null);
  const initialJson = useRef(JSON.stringify(initial));

  // Look for an interrupted session once, on mount.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && raw !== initialJson.current) setRecovered(JSON.parse(raw) as CertDraft);
    } catch {
      /* private mode, quota, corrupt JSON — recovery is a convenience, never a blocker */
    }
  }, [storageKey]);

  // Mirror every change out. Debounced with the same quiet period as the history so a burst of
  // typing is one write rather than one per keystroke.
  useEffect(() => {
    if (!storageKey) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(h.present));
      } catch {
        /* full or unavailable — keep editing */
      }
    }, QUIET_MS);
    return () => clearTimeout(t);
  }, [h.present, storageKey]);

  // `patch` must read the newest draft without being re-created on every keystroke — a changing
  // identity would re-mount every slot and take the caret with it.
  const currentRef = useRef(h.present);
  currentRef.current = h.present;

  const patch = useCallback((p: Partial<CertDraft>, immediate = false) => {
    dispatch({ type: 'set', value: { ...currentRef.current, ...p } });
    clearTimeout(timer.current);
    if (immediate) dispatch({ type: 'commit' });
    else timer.current = setTimeout(() => dispatch({ type: 'commit' }), QUIET_MS);
  }, []);

  const flushThen = useCallback((type: 'undo' | 'redo') => {
    clearTimeout(timer.current);
    dispatch({ type });
  }, []);

  const undo = useCallback(() => flushThen('undo'), [flushThen]);
  const redo = useCallback(() => flushThen('redo'), [flushThen]);

  // Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y, document-wide. Slots cancel the browser's own history so
  // these are the only ones that ever run.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const clearStored = useCallback(() => {
    if (!storageKey) return;
    try { localStorage.removeItem(storageKey); } catch { /* nothing to clean up */ }
  }, [storageKey]);

  return {
    draft: h.present,
    patch,
    undo,
    redo,
    canUndo: h.past.length > 0 || h.present !== h.committed,
    canRedo: h.future.length > 0,
    recovered,
    restore: () => {
      if (recovered) dispatch({ type: 'reset', value: recovered });
      setRecovered(null);
    },
    dismissRecovered: () => {
      setRecovered(null);
      clearStored();
    },
    clearStored,
  };
}

/* ── Slots ──────────────────────────────────────────────────────────────────────────────────── */

const slotClass = (invalid?: boolean) =>
  `cert-slot${invalid ? ' cert-slot-bad' : ''}`;

/**
 * A long value, editable as real text inside the paragraph.
 *
 * Uncontrolled on purpose. Writing `textContent` on every render is what makes a React
 * contenteditable send the caret back to the start on each keystroke; the effect below only
 * touches the DOM when the incoming value is not already what the node shows, which is true when
 * another copy of the same field changed it and false during ordinary typing.
 */
export function EditableText({
  value,
  onChange,
  placeholder,
  invalid,
  label,
  onUndo,
  onRedo,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  label: string;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Rendered as children once and never again: `initial` is frozen, so React reconciles the same
  // string every time and never writes to the node. That leaves the effect below as the only
  // writer — and it is what keeps the first paint (and the server's markup) from being blank.
  const initial = useRef(value);

  useEffect(() => {
    const el = ref.current;
    if (el && el.textContent !== value) el.textContent = value;
  }, [value]);

  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label={label}
      data-placeholder={placeholder}
      className={slotClass(invalid)}
      onInput={(e) => onChange(e.currentTarget.textContent ?? '')}
      onBeforeInput={(e) => {
        // The browser keeps its own per-element history. Left alone it fights the document-level
        // one and Ctrl+Z jumps two steps at a time.
        const t = (e.nativeEvent as InputEvent).inputType;
        if (t === 'historyUndo') { e.preventDefault(); onUndo(); }
        else if (t === 'historyRedo') { e.preventDefault(); onRedo(); }
      }}
      onPaste={(e) => {
        // Pasting from Word otherwise brings its markup into the document.
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain').replace(/\s+/g, ' ').trim();
        document.execCommand('insertText', false, text);
      }}
      onKeyDown={(e) => {
        // Line breaks belong to the layout, not to the value.
        if (e.key === 'Enter') e.preventDefault();
      }}
    >
      {initial.current}
    </span>
  );
}

type ValueKind = 'passport' | 'amount' | 'date' | 'text';

/**
 * A short value: printed text until clicked, then an input sized to its own content so the line
 * around it barely moves.
 */
export function EditableValue({
  value,
  display,
  onChange,
  kind,
  placeholder,
  invalid,
  label,
}: {
  /** The raw stored value ('4000000', '2026-07-19'). */
  value: string;
  /** How the document prints it ('4 000 000', '2026 йил 19 июль'). */
  display: string;
  onChange: (v: string) => void;
  kind: ValueKind;
  placeholder: string;
  invalid?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        aria-label={label}
        className={`${slotClass(invalid)} cert-slot-btn`}
        onClick={() => setOpen(true)}
      >
        {display || <span className="cert-slot-empty">{placeholder}</span>}
      </button>
    );
  }

  if (kind === 'date') {
    return (
      <span className="cert-slot-editing cert-slot-date">
        <DatePicker
          value={value}
          onChange={(v) => { onChange(v); setOpen(false); }}
          error={invalid}
        />
      </span>
    );
  }

  const mask = kind === 'passport' ? maskPassport : kind === 'amount' ? maskAmount : undefined;
  const shown = kind === 'amount' ? maskAmount(value) : value;

  return (
    <input
      autoFocus
      aria-label={label}
      className="cert-slot-editing"
      style={{ width: `${Math.max(shown.length, placeholder.length) + 1}ch` }}
      value={shown}
      inputMode={kind === 'amount' ? 'numeric' : undefined}
      placeholder={placeholder}
      onChange={(e) => {
        const v = mask ? mask(e.target.value) : e.target.value;
        onChange(kind === 'amount' ? unmaskAmount(v) : v);
      }}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault();
          setOpen(false);
        }
      }}
    />
  );
}

/**
 * The contract list, inline where it prints: «14.05.2026 йилдаги 8130-сонли, …».
 *
 * Add and remove sit in the flow rather than in a panel, so a second contract pushes the paragraph
 * exactly as far as it will on paper.
 */
export function EditableContracts({
  rows,
  onChange,
  invalidAt,
}: {
  rows: { number: string; date: string }[];
  onChange: (rows: { number: string; date: string }[], immediate?: boolean) => void;
  invalidAt: (i: number) => { number?: boolean; date?: boolean };
}) {
  const patch = (i: number, key: 'number' | 'date', v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  return (
    <>
      {rows.map((row, i) => {
        const bad = invalidAt(i);
        return (
          <React.Fragment key={i}>
            {i > 0 && ', '}
            <EditableValue
              kind="date"
              label={`${i + 1}-shartnoma sanasi`}
              value={row.date}
              display={row.date ? row.date.split('-').reverse().join('.') : ''}
              placeholder="00.00.0000"
              invalid={bad.date}
              onChange={(v) => patch(i, 'date', v)}
            />
            {' йилдаги '}
            <b>
              <EditableValue
                kind="text"
                label={`${i + 1}-shartnoma raqami`}
                value={row.number}
                display={row.number}
                placeholder="00000"
                invalid={bad.number}
                onChange={(v) => patch(i, 'number', v.replace(/\D/g, ''))}
              />
              -сонли
            </b>
            {rows.length > 1 && (
              <button
                type="button"
                className="cert-row-btn cert-row-del no-print"
                title="Shartnomani olib tashlash"
                aria-label={`${i + 1}-shartnomani olib tashlash`}
                onClick={() => onChange(rows.filter((_, j) => j !== i), true)}
              >
                <Ico.close size={12} />
              </button>
            )}
          </React.Fragment>
        );
      })}
      <button
        type="button"
        className="cert-row-btn no-print"
        title="Yana shartnoma qoʻshish"
        aria-label="Yana shartnoma qoʻshish"
        onClick={() => onChange([...rows, { number: '', date: '' }], true)}
      >
        <Ico.add size={12} />
      </button>
    </>
  );
}

/* ── The slot set ───────────────────────────────────────────────────────────────────────────── */

export type TextField = 'personFullName' | 'passportIssuedBy' | 'contractType';
export type ValueField = 'personPassport' | 'passportIssuedAt' | 'loanAmount' | 'asOfDate' | 'issueDate';

export const SLOT_LABELS: Record<TextField | ValueField, string> = {
  personFullName: 'Mijozning F.I.SH.',
  passportIssuedBy: 'Passportni kim bergan',
  contractType: 'Shartnoma turi',
  personPassport: 'Passport raqami',
  passportIssuedAt: 'Passport berilgan sana',
  loanAmount: 'Kredit summasi',
  asOfDate: 'Holat sanasi',
  issueDate: 'Maʼlumotnoma sanasi',
};

export const SLOT_PLACEHOLDERS: Record<TextField | ValueField, string> = {
  personFullName: 'Ф.И.Ш.',
  passportIssuedBy: 'кем берилган',
  contractType: 'шартнома тури',
  personPassport: 'AE0000000',
  passportIssuedAt: '00.00.0000',
  loanAmount: '0',
  asOfDate: '0000 йил 0 ой',
  issueDate: '00.00.0000',
};

const VALUE_KIND: Record<ValueField, ValueKind> = {
  personPassport: 'passport',
  passportIssuedAt: 'date',
  loanAmount: 'amount',
  asOfDate: 'date',
  issueDate: 'date',
};

/** ISO date-only to the UTC-midnight Date the database stores. */
export function asDate(iso: string): Date {
  return iso ? new Date(`${iso}T00:00:00.000Z`) : new Date(0);
}

/** How each short value prints — the same helpers the PDF uses, so the two cannot disagree. */
export function displayOf(field: ValueField, d: CertDraft): string {
  switch (field) {
    case 'personPassport': return d.personPassport;
    case 'loanAmount': return formatSum(d.loanAmount);
    case 'asOfDate': return d.asOfDate ? uzLongDate(asDate(d.asOfDate)) : '';
    case 'issueDate': return d.issueDate ? dmy(asDate(d.issueDate)) : '';
    case 'passportIssuedAt': return d.passportIssuedAt ? dmy(asDate(d.passportIssuedAt)) : '';
  }
}

/**
 * The editors CertificateDocument renders in place of its variable values.
 *
 * Built here rather than inside the editor screen so a test can hand the same slots to the same
 * document and check that editing and printing say the same words — the one assertion standing
 * between this feature and a screen that quietly disagrees with the frozen PDF.
 *
 * `data-slot` is what lets the save bar walk to the first unfilled value.
 */
export function certificateEditSlots(
  draft: CertDraft,
  o: {
    patch: (p: Partial<CertDraft>, immediate?: boolean) => void;
    undo: () => void;
    redo: () => void;
    invalid: (field: string) => boolean;
  },
): CertificateEdit {
  return {
    text: (field) => (
      <span data-slot={field}>
        <EditableText
          label={SLOT_LABELS[field]}
          value={draft[field]}
          placeholder={SLOT_PLACEHOLDERS[field]}
          invalid={o.invalid(field)}
          onChange={(v) => o.patch({ [field]: v } as Partial<CertDraft>)}
          onUndo={o.undo}
          onRedo={o.redo}
        />
      </span>
    ),

    value: (field) => (
      <span data-slot={field}>
        <EditableValue
          label={SLOT_LABELS[field]}
          kind={VALUE_KIND[field]}
          value={draft[field]}
          display={displayOf(field, draft)}
          placeholder={SLOT_PLACEHOLDERS[field]}
          invalid={o.invalid(field)}
          onChange={(v) => o.patch({ [field]: v } as Partial<CertDraft>)}
        />
      </span>
    ),

    contracts: () => (
      <span data-slot="contracts">
        <EditableContracts
          rows={draft.contracts}
          invalidAt={(i) => {
            const r = draft.contracts[i];
            if (!o.invalid('contracts') || !r) return {};
            return { number: !r.number.trim(), date: !r.date.trim() };
          }}
          onChange={(rows, immediate) => o.patch({ contracts: rows }, immediate)}
        />
      </span>
    ),
  };
}

/* ── Validation ─────────────────────────────────────────────────────────────────────────────── */

export interface DraftProblem {
  field: string;
  message: string;
}

/**
 * What is missing or malformed, in the order it appears on the page — the save bar walks the
 * person to the first one, so the order has to match what they see.
 */
export function draftProblems(d: CertDraft, opts: { pinfl: boolean }): DraftProblem[] {
  const out: DraftProblem[] = [];
  if (opts.pinfl && !/^\d{14}$/.test(d.personPinfl)) {
    out.push({ field: 'personPinfl', message: 'PINFL 14 ta raqam boʻlishi kerak' });
  }
  if (d.personFullName.trim().length < 4) {
    out.push({ field: 'personFullName', message: 'F.I.SH. toʻliq yozilmagan' });
  }
  if (!/^[A-Z]{2}\d{7}$/.test(d.personPassport)) {
    out.push({ field: 'personPassport', message: 'Passport 2 harf + 7 raqam (AE5348993)' });
  }
  const filled = d.contracts.filter((r) => r.number.trim() || r.date.trim());
  if (!filled.length || filled.some((r) => !r.number.trim() || !r.date.trim())) {
    out.push({ field: 'contracts', message: 'Har bir shartnomaning raqami va sanasi kerak' });
  }
  if (!unmaskAmount(d.loanAmount)) {
    out.push({ field: 'loanAmount', message: 'Kredit summasi kiritilmagan' });
  }
  if (!d.asOfDate) out.push({ field: 'asOfDate', message: 'Holat sanasi kiritilmagan' });
  if (!d.issueDate) out.push({ field: 'issueDate', message: 'Maʼlumotnoma sanasi kiritilmagan' });
  return out;
}

/** The contracts the API should receive — a row the person started and left blank is dropped. */
export function draftContracts(d: CertDraft): { number: string; date: string }[] {
  return d.contracts.filter((r) => r.number.trim() && r.date.trim());
}

/** The same rows as the document prints them, for the live preview. */
export function previewContracts(d: CertDraft): DocContract[] {
  return d.contracts.map((r) => ({ number: r.number, date: r.date ? new Date(r.date) : new Date(0) }));
}
