'use client';

import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try {
      localStorage.setItem('spravka.theme', next ? 'dark' : 'light');
    } catch {}
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="cursor-pointer rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
      aria-label={dark ? 'Yorugʻ rejimga oʻtish' : 'Qorongʻi rejimga oʻtish'}
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}
