'use client';

import { useEffect, useRef, useState } from 'react';
import { Ico } from './icons';

export interface Option {
  value: string;
  label: string;
  /** Optional colour dot (e.g. status tone). */
  dot?: string;
}

/**
 * Pro dropdown — keyboard accessible (Enter/Space/Esc/arrows), click-outside close,
 * colour dots, and a visible focus ring. Replaces the native <select> in filters.
 */
export function Select({
  value,
  options,
  onChange,
  placeholder = 'Tanlang',
  label,
  className = '',
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') return setOpen(false);
    if (!open && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown')) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const o = options[active];
      if (o) pick(o.value);
    }
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKey}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="field-input flex cursor-pointer items-center justify-between gap-2 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${selected.dot}`} />}
          <span className={`truncate ${selected ? '' : 'text-muted'}`}>{selected?.label ?? placeholder}</span>
        </span>
        <span className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}>
          <Ico.chevron size={14} />
        </span>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-64 overflow-auto rounded-xl border border-line bg-surface p-1 shadow-2xl"
        >
          {options.map((o, i) => {
            const sel = o.value === value;
            return (
              <li key={o.value || 'all'} role="option" aria-selected={sel}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    sel ? 'bg-brand-600 text-white' : i === active ? 'bg-surface-2 text-fg' : 'text-fg hover:bg-surface-2'
                  }`}
                >
                  {o.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${o.dot}`} />}
                  <span className="truncate">{o.label}</span>
                  {sel && <span className="ml-auto"><Ico.check size={14} /></span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
