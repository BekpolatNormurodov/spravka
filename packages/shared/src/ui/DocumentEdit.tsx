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
  dmy, dmyToIso, formatSum, isValidDay, isoToDmy, maskAmount, maskDmy, maskPassport,
  unmaskAmount, uzLongDateToIso, type DocContract,
} from '../core';
import { CERT_FIELD_LABELS } from '../core/labels';
import type { CertificateEdit } from './CertificateDocument';
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
  /** Machine-readable, kept in step with `asOfText` whenever that phrase can be read. */
  asOfDate: string;
  /** The «... ҳолатида» phrase as typed — this is what prints. */
  asOfText: string;
  issueDate: string;
  /**
   * The «Маълумот учун:» addressee. `null` means the document has no such line — which is not the
   * same as `''`, an empty line the person has switched on and is about to write into. The toggle
   * moves between null and `''`; typing moves between `''` and text.
   */
  infoRecipient: string | null;
}

/** How long typing has to stop before the draft is mirrored to localStorage. */
const QUIET_MS = 400;
const HISTORY_MAX = 50;

export interface DraftHistory<T> {
  past: T[];
  present: T;
  future: T[];
  /** The last value pushed into history. Differs from `present` mid-keystroke. */
  committed: T;
}

/** Starting history for a draft — exported so the reducer can be exercised without React. */
export const initialHistory = <T,>(d: T): DraftHistory<T> => ({
  past: [], present: d, future: [], committed: d,
});

export type DraftAction<T> =
  | { type: 'set'; value: T }
  | { type: 'commit' }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T };

/**
 * One history for the whole draft rather than one per field.
 *
 * Per-field history is what the browser gives away for free and it is wrong here: it cannot see a
 * contract row being added, and Ctrl+Z lands in whichever field happens to hold focus rather than
 * undoing the last thing the person actually did.
 */
export function reduceDraft<T>(s: DraftHistory<T>, a: DraftAction<T>): DraftHistory<T> {
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
      const base: DraftHistory<T> =
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

export interface DraftStore<T> {
  draft: T;
  /** Patch one or more fields. `immediate` skips coalescing — use it for structural changes. */
  patch: (p: Partial<T>, immediate?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** A stored draft was found that differs from what the server gave us. */
  recovered: T | null;
  restore: () => void;
  dismissRecovered: () => void;
  /** Drop the stored copy — call after a save lands. */
  clearStored: () => void;
}

/** The maʼlumotnoma's store — {@link useDraft} specialised to {@link CertDraft}. */
export type CertDraftStore = DraftStore<CertDraft>;

/**
 * Draft state, undo history and browser-local persistence.
 *
 * Persistence is localStorage and nothing else on purpose: `nextCertNumber` bumps an atomic
 * counter that is never reused, so creating a row to autosave into would burn an official
 * маълумотнома number on every abandoned attempt.
 */
export function useDraft<T>(initial: T, storageKey: string | null): DraftStore<T> {
  const [h, dispatch] = useReducer(
    reduceDraft as React.Reducer<DraftHistory<T>, DraftAction<T>>,
    initialHistory(initial),
  );

  const [recovered, setRecovered] = useState<T | null>(null);
  const initialJson = useRef(JSON.stringify(initial));

  // Look for an interrupted session once, on mount.
  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw && raw !== initialJson.current) setRecovered(JSON.parse(raw) as T);
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

  /** Which value the open, uncommitted step belongs to. */
  const pending = useRef<string | null>(null);

  /**
   * One undo step per value, not per pause.
   *
   * The step ends when the person moves to a different part of the document — which is how they
   * think about what they just did ("I fixed the name", "I fixed the sum"), and it does not depend
   * on how fast they type. A timer would cut a slow typist's name into four steps and merge a fast
   * one's name and passport into one.
   */
  const patch = useCallback((p: Partial<T>, immediate = false) => {
    const field = Object.keys(p).sort().join(',');
    if (pending.current !== null && pending.current !== field) dispatch({ type: 'commit' });
    dispatch({ type: 'set', value: { ...currentRef.current, ...p } });
    if (immediate) {
      dispatch({ type: 'commit' });
      pending.current = null;
    } else {
      pending.current = field;
    }
  }, []);

  const flushThen = useCallback((type: 'undo' | 'redo') => {
    // The open step is finished by the undo itself — the reducer folds it in before stepping back.
    pending.current = null;
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

/**
 * The maʼlumotnoma draft store — {@link useDraft} specialised to {@link CertDraft}, kept so every
 * existing editor call site reads exactly as before while the ariza reuses the same machinery.
 */
export const useCertDraft = (initial: CertDraft, storageKey: string | null): CertDraftStore =>
  useDraft(initial, storageKey);

/* ── Slots ──────────────────────────────────────────────────────────────────────────────────── */

const slotClass = (invalid?: boolean) =>
  `cert-slot${invalid ? ' cert-slot-bad' : ''}`;

/** Drop the caret inside an element that has no text to anchor it to. */
function placeCaret(el: HTMLElement) {
  const sel = typeof window !== 'undefined' ? window.getSelection?.() : null;
  if (!sel) return;
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Selection APIs vary; a browser that refuses this still has its own caret handling to fall
    // back on, and failing here must not stop the person from typing.
  }
}

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
      aria-multiline="false"
      aria-label={label}
      title={label}
      data-placeholder={placeholder}
      className={slotClass(invalid)}
      onFocus={(e) => {
        // Tab and click both end up here. An empty slot has no text node to anchor a caret to, so
        // one is placed explicitly; otherwise focus lands on the element and keystrokes go nowhere.
        const el = e.currentTarget;
        if (el.textContent) return;
        placeCaret(el);
      }}
      onMouseDown={(e) => {
        /*
          An empty inline contenteditable is a box browsers will not put a caret in — the click
          lands, nothing focuses, and typing goes to the page instead of the document. It looks
          exactly like a field that does not work, and it is why the placeholder slots refused to
          take a name while the masked inputs beside them were fine.

          Only when empty: with text in it, the browser's own caret placement is what the person
          expects and taking it over would drop them at the start of a name they meant to fix.
        */
        const el = e.currentTarget;
        if (el.textContent) return;
        e.preventDefault();
        el.focus();
        placeCaret(el);
      }}
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
 * A short value: printed text until clicked, then a plain masked input sized to its own content,
 * so the line around it barely moves.
 *
 * Deliberately not a date picker. A popup calendar opening inside a justified 14pt paragraph
 * displaces the text it is meant to sit in, and a clerk copying «27.10.2024» off a contract wants
 * to type eight digits, not navigate three months back. The mask does the rest.
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
  placeholder?: string;
  invalid?: boolean;
  label: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        className={`${slotClass(invalid)} cert-slot-btn`}
        data-placeholder={placeholder}
        onClick={() => setOpen(true)}
        // Tab lands here and opens it, so the whole document can be filled from the keyboard
        // without reaching for the mouse between every value. Closing on blur means Tab out is
        // the same gesture — focus has already moved on by the time this button renders again.
        onFocus={() => setOpen(true)}
      >
        {display}
      </button>
    );
  }

  return (
    <ValueInput
      key="editing"
      value={value}
      onChange={onChange}
      kind={kind}
      placeholder={placeholder}
      label={label}
      onDone={() => setOpen(false)}
    />
  );
}

/** How each kind reads while it is being typed, which is not always how it is stored. */
function toText(kind: ValueKind, value: string): string {
  if (kind === 'date') return isoToDmy(value);
  if (kind === 'amount') return maskAmount(value);
  return value;
}

/**
 * The open editor. Its own component so it can hold the half-typed text: '27.10' is a real thing
 * to have on screen and not a date, so the input keeps it while the stored value stays empty.
 */
function ValueInput({
  value, onChange, kind, placeholder, label, onDone,
}: {
  value: string;
  onChange: (v: string) => void;
  kind: ValueKind;
  placeholder?: string;
  label: string;
  onDone: () => void;
}) {
  const [text, setText] = useState(() => toText(kind, value));

  const handle = (raw: string) => {
    if (kind === 'date') {
      const masked = maskDmy(raw);
      setText(masked);
      onChange(dmyToIso(masked));
      return;
    }
    if (kind === 'amount') {
      const masked = maskAmount(raw);
      setText(masked);
      onChange(unmaskAmount(masked));
      return;
    }
    const masked = kind === 'passport' ? maskPassport(raw) : raw;
    setText(masked);
    onChange(masked);
  };

  /*
    The wrapper is what sets the width, not the input.

    `data-value` is echoed by a hidden ::after in the same grid cell, so the box is exactly as wide
    as the text rendered in the document's own font — no wider. Measuring in `ch` was the previous
    attempt and it stretched the line: `ch` is the width of a zero, and in Times a zero is wider
    than most of the letters it was standing in for, so opening a slot shoved the whole justified
    paragraph sideways.
  */
  /*
    Two hidden copies decide the width, and the wider one wins — they share a single grid cell, so
    the box is max(placeholder, text) and never less than the example that was showing before it
    was clicked. Sizing from the text alone made the slot snap down to one character on the first
    keystroke and creep back out as the value was typed.

    The input is absolutely positioned and so contributes nothing to that measurement, which is
    the whole reason it can be laid over them.
  */
  return (
    <span className="cert-fit">
      <span className="cert-fit-sizer" aria-hidden="true">{placeholder ?? ''}</span>
      <span className="cert-fit-sizer" aria-hidden="true">{text}</span>
      <input
        autoFocus
        size={1}
        aria-label={label}
        title={label}
        placeholder={placeholder}
        className="cert-slot-editing"
        value={text}
        inputMode={kind === 'amount' || kind === 'date' ? 'numeric' : undefined}
        onChange={(e) => handle(e.target.value)}
        onBlur={onDone}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Escape') {
            e.preventDefault();
            onDone();
          }
        }}
      />
    </span>
  );
}

/**
 * The contract list, inline where it prints: «14.05.2026 йилдаги 8130-сонли, …».
 *
 * Adding is a control in the bar above the paper, not a button in the sentence: a «+» sitting in
 * the middle of a legal paragraph reads as part of the document. Removing stays here, because it
 * has to say *which* contract, but it is invisible until the row is hovered.
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
              display={isoToDmy(row.date)}
              placeholder="01.01.2026"
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
                placeholder="8130"
                invalid={bad.number}
                onChange={(v) => patch(i, 'number', v.replace(/\D/g, ''))}
              />
              -сонли
            </b>
            {rows.length > 1 && (
              <button
                type="button"
                className="cert-row-del no-print"
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
    </>
  );
}

/* ── The slot set ───────────────────────────────────────────────────────────────────────────── */

export type TextField =
  'personFullName' | 'passportIssuedBy' | 'contractType' | 'asOfText' | 'infoRecipient';
export type ValueField = 'personPassport' | 'passportIssuedAt' | 'loanAmount' | 'issueDate';

/*
  A slot's name comes from core's CERT_FIELD_LABELS, not a second copy here: the same value is
  named in an API error when it is missing, and two lists would eventually call one field two
  things. It is read where it is used rather than aliased to a local const — a module-scope
  `export const X = CERT_FIELD_LABELS` runs during module evaluation, and in the client bundle
  that ran before the barrel it comes from had finished initialising: ReferenceError on every
  page that loads the editor.
*/

/**
 * Grey examples of what belongs in each slot, shown only while it is empty.
 *
 * Real-looking samples rather than «00.00.0000» — a row of zeroes reads as the document asserting
 * something, and it shouts over what is actually written. These say what shape the value takes and
 * then get out of the way. They cannot reach paper: the PDF renders the same component with no
 * `edit` prop, and a placeholder only exists inside an editor.
 */
/**
 * What the «Маълумот учун:» line says until someone changes it.
 *
 * A real value, not a grey example: switching the line on writes this into the draft, and saving
 * straight away saves exactly this. Nearly every one of these goes to the same insurance company,
 * so the common case is a document that is already right — which is also why the toolbar button
 * is labelled «Sugʻurta» rather than after the line it adds.
 */
export const DEFAULT_INFO_RECIPIENT = '«KAPITAL SUGʻURTA» Акциядорлик жамиятига';

export const SLOT_PLACEHOLDERS: Record<TextField | ValueField, string> = {
  personFullName: 'Ф.И.Ш.',
  passportIssuedBy: 'Олмазор ИИБ',
  contractType: '«Микроқарз» универсал шартномаси',
  personPassport: 'AA1234567',
  passportIssuedAt: '01.01.2026',
  loanAmount: '4 000 000',
  asOfText: '2026 йил 1 январь',
  issueDate: '01.01.2026',
  // Only ever seen when the line has been cleared by hand — it arrives already written. Same text
  // as the default, so the example and the thing it is an example of cannot drift apart.
  infoRecipient: DEFAULT_INFO_RECIPIENT,
};

const VALUE_KIND: Record<ValueField, ValueKind> = {
  personPassport: 'passport',
  passportIssuedAt: 'date',
  loanAmount: 'amount',
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
          label={CERT_FIELD_LABELS[field]}
          placeholder={SLOT_PLACEHOLDERS[field]}
          // `infoRecipient` is the one text field that can be null, and null only reaches here
          // when the line is switched on — the document does not render the slot otherwise.
          value={draft[field] ?? ''}
          invalid={o.invalid(field)}
          onChange={(v) => o.patch(
            field === 'asOfText'
              // The phrase is what prints; the date follows it whenever it can be read. A phrase
              // mid-typing reads as nothing, so the date holds its last good value rather than
              // being cleared and re-guessed on every keystroke.
              ? { asOfText: v, ...(uzLongDateToIso(v) ? { asOfDate: uzLongDateToIso(v) } : {}) }
              : { [field]: v } as Partial<CertDraft>,
          )}
          onUndo={o.undo}
          onRedo={o.redo}
        />
      </span>
    ),

    value: (field) => (
      <span data-slot={field}>
        <EditableValue
          label={CERT_FIELD_LABELS[field]}
          placeholder={SLOT_PLACEHOLDERS[field]}
          kind={VALUE_KIND[field]}
          value={draft[field]}
          display={displayOf(field, draft)}
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
    out.push({
      field: 'personPinfl',
      message: d.personPinfl.trim()
        ? `PINFL 14 ta raqam boʻlishi kerak — hozir ${d.personPinfl.replace(/\D/g, '').length} ta`
        : 'PINFL kiritilmagan',
    });
  }
  if (d.personFullName.trim().length < 4) {
    out.push({ field: 'personFullName', message: 'F.I.SH. toʻliq yozilmagan' });
  }
  /*
    Only checked once the line exists. Switching it on and leaving it blank would print «Маълумот
    учун:» pointing at nobody — so an empty line is a problem, while no line at all is not.
  */
  if (d.infoRecipient !== null && !d.infoRecipient.trim()) {
    out.push({ field: 'infoRecipient', message: 'Maʼlumot uchun — tashkilot yozilmagan' });
  }

  if (!/^[A-Z]{2}\d{7}$/.test(d.personPassport)) {
    out.push({ field: 'personPassport', message: 'Passport 2 harf + 7 raqam (AE5348993)' });
  }

  /*
    Every contract is checked as a whole date, not merely as something typed. «31.02.2026» reaches
    the API as a Date that MySQL turns into 3 March, and the maʼlumotnoma then names a contract on
    a day it was not signed — wrong, printed, and impossible to spot afterwards.
  */
  const filled = d.contracts.filter((r) => r.number.trim() || r.date.trim());
  if (!filled.length) {
    out.push({ field: 'contracts', message: 'Kamida bitta shartnoma kerak' });
  } else if (filled.some((r) => !r.number.trim() || !r.date.trim())) {
    out.push({ field: 'contracts', message: 'Har bir shartnomaning raqami va sanasi kerak' });
  } else if (filled.some((r) => !isValidDay(r.date))) {
    out.push({ field: 'contracts', message: 'Shartnoma sanasi notoʻgʻri' });
  }

  const sum = unmaskAmount(d.loanAmount);
  if (!sum) out.push({ field: 'loanAmount', message: 'Kredit summasi kiritilmagan' });
  else if (Number(sum) <= 0) out.push({ field: 'loanAmount', message: 'Kredit summasi noldan katta boʻlsin' });

  // The phrase is what prints, so the phrase is what must be right. `asOfDate` follows it and is
  // never the thing the person typed — an unreadable phrase leaves it at its last good value, so
  // checking the date instead of the words would pass a document that says something else.
  if (!d.asOfText.trim()) {
    out.push({ field: 'asOfText', message: 'Holat sanasi kiritilmagan' });
  } else if (!uzLongDateToIso(d.asOfText)) {
    out.push({ field: 'asOfText', message: 'Holat sanasi oʻqilmadi — «2026 йил 19 июль» koʻrinishida yozing' });
  }

  if (!d.issueDate) out.push({ field: 'issueDate', message: 'Maʼlumotnoma sanasi kiritilmagan' });
  else if (!isValidDay(d.issueDate)) out.push({ field: 'issueDate', message: 'Maʼlumotnoma sanasi notoʻgʻri' });

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
