'use client';

/**
 * The editable content of an «Ишончнома», and the slots that make it editable where it prints — the
 * ishonchnoma sibling of DocumentEdit/ArizaEdit. Reuses the same slot components and the generic
 * draft history (useDraft), so the three documents cannot drift into different editors.
 */

import React from 'react';
import { asDate, EditableText, EditableValue, type DraftProblem } from './DocumentEdit';
import { dmy, isValidDay, isValidPinfl } from '../core';
import { CERT_FIELD_LABELS } from '../core/labels';
import type { PowerOfAttorneyEdit } from './PowerOfAttorneyDocument';

/** The editable content of one ishonchnoma. Dates stay ISO strings until the API parses them. */
export interface PoaDraft {
  personFullName: string;
  personPinfl: string;
  personPassport: string;
  poaBankName: string;
  poaContractDate: string;
  poaContractNumber: string;
  poaValidUntil: string;
  issueDate: string;
}

type PoaTextField = Parameters<PowerOfAttorneyEdit['text']>[0];
type PoaValueField = Parameters<PowerOfAttorneyEdit['value']>[0];

export const POA_SLOT_PLACEHOLDERS: Record<PoaTextField | PoaValueField, string> = {
  personFullName: 'F.I.SH.',
  personPassport: 'AE 1020513',
  poaBankName: 'ANORBANK',
  poaContractNumber: '1',
  issueDate: '01.01.2026',
  poaContractDate: '01.01.2026',
  poaValidUntil: '01.01.2026',
};

/** A blank ishonchnoma dated `issueDate`. */
export function defaultPoaDraft(issueDate: string): PoaDraft {
  return {
    personFullName: '', personPinfl: '', personPassport: '',
    poaBankName: '', poaContractDate: '', poaContractNumber: '', poaValidUntil: '',
    issueDate,
  };
}

/** How each short value prints — the same helper the PDF uses. */
function displayOf(field: PoaValueField, d: PoaDraft): string {
  return d[field] ? dmy(asDate(d[field])) : '';
}

/**
 * The editors PowerOfAttorneyDocument renders in place of its variable values — built here so a test
 * can hand the same slots to the same document and check editing prints what saving freezes.
 */
export function poaEditSlots(
  draft: PoaDraft,
  o: {
    patch: (p: Partial<PoaDraft>, immediate?: boolean) => void;
    undo: () => void;
    redo: () => void;
    invalid: (field: string) => boolean;
  },
): PowerOfAttorneyEdit {
  return {
    text: (field) => (
      <span data-slot={field}>
        <EditableText
          label={CERT_FIELD_LABELS[field]}
          placeholder={POA_SLOT_PLACEHOLDERS[field]}
          value={draft[field]}
          invalid={o.invalid(field)}
          onChange={(v) => o.patch({ [field]: v } as Partial<PoaDraft>)}
          onUndo={o.undo}
          onRedo={o.redo}
        />
      </span>
    ),

    value: (field) => (
      <span data-slot={field}>
        <EditableValue
          label={CERT_FIELD_LABELS[field]}
          placeholder={POA_SLOT_PLACEHOLDERS[field]}
          kind="date"
          value={draft[field]}
          display={displayOf(field, draft)}
          invalid={o.invalid(field)}
          onChange={(v) => o.patch({ [field]: v } as Partial<PoaDraft>)}
        />
      </span>
    ),
  };
}

/** What is missing or malformed, in the order it appears on the page. */
export function poaDraftProblems(d: PoaDraft): DraftProblem[] {
  const out: DraftProblem[] = [];
  const need = (field: string, ok: boolean, message: string) => { if (!ok) out.push({ field, message }); };

  if (!d.issueDate) out.push({ field: 'issueDate', message: 'Sana kiritilmagan' });
  else if (!isValidDay(d.issueDate)) out.push({ field: 'issueDate', message: 'Sana notoʻgʻri' });

  need('poaBankName', !!d.poaBankName.trim(), 'Bank kiritilmagan');

  if (!d.poaContractDate) out.push({ field: 'poaContractDate', message: 'Shartnoma sanasi kiritilmagan' });
  else if (!isValidDay(d.poaContractDate)) out.push({ field: 'poaContractDate', message: 'Shartnoma sanasi notoʻgʻri' });
  need('poaContractNumber', !!d.poaContractNumber.trim(), 'Shartnoma raqami kiritilmagan');

  need('personFullName', d.personFullName.trim().length >= 4, 'F.I.SH. toʻliq yozilmagan');
  if (!isValidPinfl(d.personPinfl)) {
    out.push({
      field: 'personPinfl',
      message: d.personPinfl.trim()
        ? `PINFL 14 ta raqam boʻlishi kerak — hozir ${d.personPinfl.replace(/\D/g, '').length} ta`
        : 'PINFL kiritilmagan',
    });
  }
  need('personPassport', !!d.personPassport.trim(), 'Passport kiritilmagan');

  if (!d.poaValidUntil) out.push({ field: 'poaValidUntil', message: 'Amal muddati kiritilmagan' });
  else if (!isValidDay(d.poaValidUntil)) out.push({ field: 'poaValidUntil', message: 'Amal muddati notoʻgʻri' });

  return out;
}
