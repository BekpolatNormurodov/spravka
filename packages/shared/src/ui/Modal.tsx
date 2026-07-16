'use client';

import React, { useEffect } from 'react';
import { Ico } from './icons';

/** Static classes only — Tailwind's JIT cannot see interpolated class names. */
const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export function Modal({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  size = 'md',
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  size?: keyof typeof SIZES;
}) {
  // Escape route (Apple HIG): Esc always dismisses.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div className={`card relative w-full ${SIZES[size]} p-6 shadow-2xl animate-fade-in`}>
        <button
          onClick={onClose}
          className="absolute right-4 top-4 cursor-pointer rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-fg"
          aria-label="Yopish"
          type="button"
        >
          <Ico.close size={18} />
        </button>
        <h3 className="pr-8 text-base font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-4">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
