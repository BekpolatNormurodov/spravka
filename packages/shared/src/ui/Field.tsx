'use client';

import React, { useId, useState } from 'react';
import { Ico } from './icons';

interface Base {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
}

function Shell({
  label, required, hint, error, id, children, className = '',
}: Base & { id: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {children}
      {/* Error takes the slot next to the field (ux: error-placement, aria-live) */}
      {error ? (
        <p id={`${id}-err`} role="alert" className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/** Pro text field: visible label, optional mask, prefix/suffix, hint, inline error. */
export function TextField({
  value,
  onChange,
  mask,
  placeholder,
  type = 'text',
  inputMode,
  suffix,
  autoFocus,
  ...base
}: Base & {
  value: string;
  onChange: (v: string) => void;
  /** Pure formatter applied on every keystroke (see @spravka/shared/core masks). */
  mask?: (v: string) => string;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'decimal';
  suffix?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Shell {...base} id={id}>
      <div className="relative">
        <input
          id={id}
          type={type}
          inputMode={inputMode}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(mask ? mask(e.target.value) : e.target.value)}
          placeholder={placeholder}
          aria-invalid={!!base.error}
          aria-describedby={base.error ? `${id}-err` : base.hint ? `${id}-hint` : undefined}
          className={`field-input ${suffix ? 'pr-14' : ''} ${base.error ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/25' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted">
            {suffix}
          </span>
        )}
      </div>
    </Shell>
  );
}

/**
 * Pro date field. Wraps the native date input on purpose — ui-ux-pro-max `system-controls`:
 * prefer native/system controls (mobile pickers, keyboard, locale, a11y) over custom ones.
 */
export function DateField({
  value,
  onChange,
  min,
  max,
  ...base
}: Base & { value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  const id = useId();
  return (
    <Shell {...base} id={id}>
      <div className="relative">
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!base.error}
          className={`field-input pr-10 [&::-webkit-calendar-picker-indicator]:opacity-0 ${
            base.error ? 'border-rose-500/60 focus:border-rose-500 focus:ring-rose-500/25' : ''
          }`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">
          <Ico.calendar size={16} />
        </span>
      </div>
    </Shell>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  ...base
}: Base & { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const id = useId();
  return (
    <Shell {...base} id={id}>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={!!base.error}
        className={`field-input resize-y ${base.error ? 'border-rose-500/60' : ''}`}
      />
    </Shell>
  );
}

/** Password field with a show/hide toggle (ux: password-toggle). */
export function PasswordField({
  value,
  onChange,
  placeholder,
  ...base
}: Base & { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const id = useId();
  const [show, setShow] = useState(false);
  return (
    <Shell {...base} id={id}>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="field-input pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Parolni yashirish' : 'Parolni koʻrsatish'}
          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
        >
          <Ico.eye size={16} />
        </button>
      </div>
    </Shell>
  );
}
