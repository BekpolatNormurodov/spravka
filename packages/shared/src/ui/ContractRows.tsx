'use client';

import React from 'react';
import { TextField, DateField } from './Field';
import { Ico } from './icons';

/** A contract row as the form holds it — dates stay ISO strings until the API parses them. */
export interface ContractRow {
  number: string;
  date: string;
}

export const emptyContractRow = (): ContractRow => ({ number: '', date: '' });

/**
 * The contracts a maʼlumotnoma covers. The real blanks routinely list two, so this is a list
 * rather than a pair of fields — shared by the yurist's create form and the admin's edit form
 * so the two cannot drift.
 */
export function ContractRows({
  rows,
  onChange,
  disabled,
}: {
  rows: ContractRow[];
  onChange: (rows: ContractRow[]) => void;
  disabled?: boolean;
}) {
  const patch = (i: number, key: keyof ContractRow) => (v: string) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  const add = () => onChange([...rows, emptyContractRow()]);
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i));

  return (
    <div className="space-y-3">
      {rows.map((row, i) => (
        <div key={i} className="rounded-xl border border-line p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {rows.length > 1 ? `${i + 1}-shartnoma` : 'Shartnoma'}
            </span>
            {rows.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                disabled={disabled}
                className="cursor-pointer rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:text-rose-400"
                aria-label={`${i + 1}-shartnomani olib tashlash`}
                title="Olib tashlash"
              >
                <Ico.close size={16} />
              </button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Raqami"
              required
              value={row.number}
              onChange={patch(i, 'number')}
              inputMode="numeric"
              placeholder="24273"
              disabled={disabled}
            />
            <DateField label="Sanasi" required value={row.date} onChange={patch(i, 'date')} disabled={disabled} />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="btn-ghost w-full justify-center py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Ico.add size={16} /> Yana shartnoma qoʻshish
      </button>
    </div>
  );
}

/** True when every row the user kept is complete — mirrors parseContracts on the server. */
export function contractRowsValid(rows: ContractRow[]): boolean {
  const filled = rows.filter((r) => r.number.trim() || r.date.trim());
  return filled.length > 0 && filled.every((r) => r.number.trim() && r.date.trim());
}
