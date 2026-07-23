'use client';

/**
 * The editable content of a «Savdo-sanoat palatasiga ariza», and the slots that make it editable
 * where it prints. The ariza analogue of the maʼlumotnoma's DocumentEdit — it reuses the same slot
 * components (EditableText/EditableValue/EditableContracts) and the same generic draft history
 * (useDraft), so the two documents cannot drift into different editors.
 *
 * Nothing here is imported by CourtArizaDocument. It receives these through render props, so
 * @spravka/shared/pdf renders the same component under Node without a browser bundle.
 */

import React from 'react';
import {
  asDate, EditableText, EditableValue, EditableContracts, previewContracts, type DraftProblem,
} from './DocumentEdit';
import {
  arizaHeaderDate, formatSumDecimal, isValidDay, isValidPinfl, uzLongDateLatinToIso, type DocContract,
} from '../core';
import { CERT_FIELD_LABELS, type CertField } from '../core/labels';
import { CHAMBER_SIGNER } from '../core/chamber';
import type { CourtArizaEdit } from './CourtArizaDocument';

/** The editable content of one ariza. Dates and money stay strings until the API parses them. */
export interface ArizaDraft {
  courtName: string;
  personFullName: string;
  personPinfl: string;
  personAddress: string;
  personPhone: string;
  contracts: { number: string; date: string }[];
  contractType: string;
  interestRate: string;
  loanAmount: string;
  /** Machine-readable, kept in step with `asOfText` whenever that Latin phrase can be read. */
  asOfDate: string;
  asOfText: string;
  /** Money is dot-decimal ('24318882.63'). */
  debtPrincipal: string;
  debtTermInterest: string;
  debtOverduePrincipal: string;
  debtOverdueInterest: string;
  debtTotal: string;
  chamberSignerPosition: string;
  chamberSignerName: string;
  chamberExecutorName: string;
  chamberExecutorPhone: string;
  issueDate: string;
}

type ArizaTextField = Parameters<CourtArizaEdit['text']>[0];
type ArizaValueField = Parameters<CourtArizaEdit['value']>[0];

/** The four debt components whose sum is the jami. */
const DEBT_COMPONENTS = [
  'debtPrincipal', 'debtTermInterest', 'debtOverduePrincipal', 'debtOverdueInterest',
] as const;

/** Grey examples, shown only while a slot is empty (they can never reach paper — the PDF has no `edit`). */
export const ARIZA_SLOT_PLACEHOLDERS: Record<ArizaTextField | ArizaValueField, string> = {
  courtName: 'Fuqarolik ishlari boʻyicha … tumanlararo sudiga',
  personFullName: 'F.I.SH.',
  personAddress: 'Viloyat, tuman, MFY, koʻcha, uy',
  personPhone: '998901234567',
  contractType: 'ONLAYN',
  interestRate: '54',
  asOfText: '2026 yil 1 iyul',
  chamberSignerPosition: CHAMBER_SIGNER.position,
  chamberSignerName: CHAMBER_SIGNER.name,
  chamberExecutorName: CHAMBER_SIGNER.executorName,
  chamberExecutorPhone: CHAMBER_SIGNER.executorPhone,
  issueDate: '01.01.2026',
  loanAmount: '24 900 000',
  debtPrincipal: '24 318 882,63',
  debtTermInterest: '143 914,49',
  debtOverduePrincipal: '577 575,43',
  debtOverdueInterest: '2 224 630,19',
  debtTotal: '27 265 002,74',
};

/** A blank ariza for `firmId`, seeded with the standing chamber defaults so the common case is quick. */
export function defaultArizaDraft(issueDate: string): ArizaDraft {
  return {
    courtName: '',
    personFullName: '', personPinfl: '', personAddress: '', personPhone: '',
    contracts: [{ number: '', date: '' }],
    contractType: 'ONLAYN', interestRate: '', loanAmount: '',
    asOfDate: '', asOfText: '',
    debtPrincipal: '', debtTermInterest: '', debtOverduePrincipal: '', debtOverdueInterest: '', debtTotal: '',
    chamberSignerPosition: CHAMBER_SIGNER.position,
    chamberSignerName: CHAMBER_SIGNER.name,
    chamberExecutorName: CHAMBER_SIGNER.executorName,
    chamberExecutorPhone: CHAMBER_SIGNER.executorPhone,
    issueDate,
  };
}

/**
 * Sets `debtTotal` to the sum of the four components — the auto-sum the editor runs whenever one of
 * them changes. Leaves the total alone while nothing has been entered, so an empty draft is not
 * forced to «0».
 */
export function arizaWithComputedTotal(d: ArizaDraft): ArizaDraft {
  const parts = DEBT_COMPONENTS.map((k) => d[k]);
  if (parts.every((p) => !p.trim())) return d;
  const sum = parts.reduce((a, p) => a + (Number(p) || 0), 0);
  return { ...d, debtTotal: sum.toFixed(2) };
}

/** How each short value prints — the same helpers the PDF uses, so the two cannot disagree. */
function displayOf(field: ArizaValueField, d: ArizaDraft): string {
  if (field === 'issueDate') return d.issueDate ? arizaHeaderDate(asDate(d.issueDate)) : '';
  return d[field] ? formatSumDecimal(d[field]) : '';
}

/**
 * The editors CourtArizaDocument renders in place of its variable values. Built here rather than in
 * the editor screen so a test can hand the same slots to the same document and check that editing
 * and printing say the same words.
 */
export function arizaEditSlots(
  draft: ArizaDraft,
  o: {
    patch: (p: Partial<ArizaDraft>, immediate?: boolean) => void;
    undo: () => void;
    redo: () => void;
    invalid: (field: string) => boolean;
  },
): CourtArizaEdit {
  return {
    text: (field) => (
      <span data-slot={field}>
        <EditableText
          label={CERT_FIELD_LABELS[field]}
          placeholder={ARIZA_SLOT_PLACEHOLDERS[field]}
          value={draft[field]}
          invalid={o.invalid(field)}
          onChange={(v) => o.patch(
            field === 'asOfText'
              // The phrase is what prints; the date follows it whenever it can be read.
              ? { asOfText: v, ...(uzLongDateLatinToIso(v) ? { asOfDate: uzLongDateLatinToIso(v) } : {}) }
              : ({ [field]: v } as Partial<ArizaDraft>),
          )}
          onUndo={o.undo}
          onRedo={o.redo}
        />
      </span>
    ),

    value: (field) => {
      const isComponent = (DEBT_COMPONENTS as readonly string[]).includes(field);
      return (
        <span data-slot={field}>
          <EditableValue
            label={CERT_FIELD_LABELS[field]}
            placeholder={ARIZA_SLOT_PLACEHOLDERS[field]}
            kind={field === 'issueDate' ? 'date' : 'decimal'}
            value={draft[field]}
            display={displayOf(field, draft)}
            invalid={o.invalid(field)}
            onChange={(v) => o.patch(
              // A component change re-sums the jami; everything else patches on its own.
              isComponent
                ? ({ [field]: v, debtTotal: arizaWithComputedTotal({ ...draft, [field]: v }).debtTotal } as Partial<ArizaDraft>)
                : ({ [field]: v } as Partial<ArizaDraft>),
            )}
          />
        </span>
      );
    },

    contracts: () => (
      <span data-slot="contracts">
        <EditableContracts
          rows={draft.contracts}
          connector="-yildagi "
          suffix="-sonli"
          boldNumber={false}
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

/**
 * What is missing or malformed, in the order it appears on the page — the save bar walks the person
 * to the first one. No passport check: an ariza debtor is identified by PINFL.
 */
export function arizaDraftProblems(d: ArizaDraft): DraftProblem[] {
  const out: DraftProblem[] = [];
  const need = (field: CertField, ok: boolean, message: string) => { if (!ok) out.push({ field, message }); };

  need('courtName', d.courtName.trim().length > 3, 'Sud nomi yozilmagan');
  need('personFullName', d.personFullName.trim().length >= 4, 'F.I.SH. toʻliq yozilmagan');

  if (!isValidPinfl(d.personPinfl)) {
    out.push({
      field: 'personPinfl',
      message: d.personPinfl.trim()
        ? `PINFL 14 ta raqam boʻlishi kerak — hozir ${d.personPinfl.replace(/\D/g, '').length} ta`
        : 'PINFL kiritilmagan',
    });
  }
  need('personAddress', d.personAddress.trim().length > 3, 'Qarzdor manzili yozilmagan');
  need('personPhone', d.personPhone.replace(/\D/g, '').length >= 7, 'Qarzdor telefoni yozilmagan');

  const filled = d.contracts.filter((r) => r.number.trim() || r.date.trim());
  if (!filled.length) out.push({ field: 'contracts', message: 'Kamida bitta shartnoma kerak' });
  else if (filled.some((r) => !r.number.trim() || !r.date.trim())) {
    out.push({ field: 'contracts', message: 'Har bir shartnomaning raqami va sanasi kerak' });
  } else if (filled.some((r) => !isValidDay(r.date))) {
    out.push({ field: 'contracts', message: 'Shartnoma sanasi notoʻgʻri' });
  }

  need('interestRate', !!d.interestRate.trim(), 'Yillik foiz kiritilmagan');
  if (!(Number(d.loanAmount) > 0)) out.push({ field: 'loanAmount', message: 'Ajratilgan kredit summasi kiritilmagan' });

  if (!d.asOfText.trim()) out.push({ field: 'asOfText', message: 'Holat sanasi kiritilmagan' });
  else if (!uzLongDateLatinToIso(d.asOfText)) {
    out.push({ field: 'asOfText', message: 'Holat sanasi oʻqilmadi — «2026 yil 15 iyul» koʻrinishida yozing' });
  }

  for (const k of DEBT_COMPONENTS) {
    if (!(Number(d[k]) >= 0) || !d[k].trim()) out.push({ field: k, message: `${CERT_FIELD_LABELS[k]} kiritilmagan` });
  }
  if (!(Number(d.debtTotal) > 0)) out.push({ field: 'debtTotal', message: 'Jami qarzdorlik kiritilmagan' });

  if (!d.issueDate) out.push({ field: 'issueDate', message: 'Ariza sanasi kiritilmagan' });
  else if (!isValidDay(d.issueDate)) out.push({ field: 'issueDate', message: 'Ariza sanasi notoʻgʻri' });

  return out;
}

/** The contracts the API should receive — a row started and left blank is dropped. */
export function arizaDraftContracts(d: ArizaDraft): { number: string; date: string }[] {
  return d.contracts.filter((r) => r.number.trim() && r.date.trim());
}

/** The same rows as the document prints them, for the live preview. */
export function arizaPreviewContracts(d: ArizaDraft): DocContract[] {
  return previewContracts(d);
}
