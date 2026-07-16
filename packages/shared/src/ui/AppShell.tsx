'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Archive, BarChart3, Building2, Calendar, CheckCircle2, FilePlus2, Files,
  LayoutDashboard, LogOut, Menu, PenLine, User, Users, X,
} from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

/** Icon registry — nav items reference icons by key so a server component can
 *  pass nav data across the RSC boundary (components aren't serializable). */
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  chart: BarChart3,
  'file-plus': FilePlus2,
  files: Files,
  building: Building2,
  users: Users,
  calendar: Calendar,
  pen: PenLine,
  check: CheckCircle2,
  archive: Archive,
  user: User,
};

export type IconKey = keyof typeof ICONS;

export interface NavItem {
  href: string;
  label: string;
  /** Key from the icon registry (serializable across the RSC boundary). */
  icon: string;
  badge?: number;
  /** Uppercase section heading this item is grouped under. */
  section?: string;
}

export interface AppShellProps {
  appName: string;
  initials: string;
  /** Tailwind bg class for the logo mark, e.g. 'bg-brand-600'. */
  accentClass?: string;
  nav: NavItem[];
  user: { fullName: string; roleLabel?: string };
  logoutAction?: string;
  children: React.ReactNode;
}

/** Sidebar-panel glyph — filled strip when expanded, hollow when collapsed. */
function PanelToggle({ className, open }: { className?: string; open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <line x1="9" y1="4" x2="9" y2="20" />
      {open && <rect x="4.2" y="5.2" width="3.6" height="13.6" rx="1" fill="currentColor" stroke="none" opacity={0.25} />}
    </svg>
  );
}

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function AppShell({
  appName,
  initials,
  accentClass = 'bg-brand-600',
  nav,
  user,
  logoutAction = '/api/auth/logout',
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem('spravka.sidebar.collapsed') === '1');
  }, []);
  useEffect(() => {
    localStorage.setItem('spravka.sidebar.collapsed', collapsed ? '1' : '0');
  }, [collapsed]);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const current = nav.find((n) => isActive(n.href));

  // Group by section, preserving order.
  const sections: { label: string; items: NavItem[] }[] = [];
  for (const item of nav) {
    const label = item.section ?? 'Menyu';
    const g = sections.find((s) => s.label === label);
    if (g) g.items.push(item);
    else sections.push({ label, items: [item] });
  }

  const rail = collapsed;

  const renderItem = (item: NavItem) => {
    const active = isActive(item.href);
    const Icon = ICONS[item.icon] ?? Files;
    return (
      <Link
        key={item.href}
        href={item.href}
        title={item.label}
        aria-current={active ? 'page' : undefined}
        className={cx(
          'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          rail && 'xl:justify-center xl:px-0',
          active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg',
        )}
      >
        {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400" />}
        <Icon className={cx('h-5 w-5 shrink-0', active && 'text-brand-600 dark:text-brand-400')} />
        <span className={cx('flex-1 truncate', rail && 'xl:hidden')}>{item.label}</span>
        {!!item.badge && (
          <span className={cx('shrink-0 rounded-full bg-brand-600 px-1.5 text-[10px] font-semibold leading-5 text-white', rail && 'xl:hidden')}>
            {item.badge > 99 ? '99+' : item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="min-h-screen">
      {open && (
        <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm xl:hidden" onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-surface px-4 py-5 transition-all duration-300 ease-in-out',
          open ? 'translate-x-0' : '-translate-x-full xl:translate-x-0',
          rail ? 'w-[264px] xl:w-[84px]' : 'w-[264px]',
        )}
        style={{ borderColor: 'var(--line)' }}
      >
        <div className={cx('mb-5 flex items-center gap-2.5 px-1', rail && 'xl:justify-center')}>
          <div className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl font-bold text-white', accentClass)}>{initials}</div>
          <div className={cx('min-w-0', rail && 'xl:hidden')}>
            <div className="truncate text-sm font-semibold leading-tight">{appName}</div>
            <div className="text-xs text-muted">Maʼlumotnoma</div>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-surface-2 xl:hidden" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto">
          {sections.map((s) => (
            <div key={s.label}>
              <div className={cx('px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted', rail && 'xl:hidden')}>{s.label}</div>
              <div className="space-y-1">{s.items.map(renderItem)}</div>
            </div>
          ))}
        </nav>

        <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
          <div className={cx('mb-2 flex items-center gap-2.5 px-1', rail && 'xl:justify-center')}>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold">
              {user.fullName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
            </div>
            <div className={cx('min-w-0', rail && 'xl:hidden')}>
              <div className="truncate text-sm font-medium">{user.fullName}</div>
              {user.roleLabel && <div className="text-xs text-muted">{user.roleLabel}</div>}
            </div>
          </div>
          <form action={logoutAction} method="post">
            <button className={cx('btn-ghost w-full', rail && 'xl:px-0')} title="Chiqish">
              <LogOut className="h-4 w-4 shrink-0" />
              <span className={cx(rail && 'xl:hidden')}>Chiqish</span>
            </button>
          </form>
        </div>
      </aside>

      <div className={cx('transition-all duration-300', rail ? 'xl:pl-[84px]' : 'xl:pl-[264px]')}>
        <header
          className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-bg/80 px-4 backdrop-blur-xl md:px-6"
          style={{ borderColor: 'var(--line)' }}
        >
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface-2 xl:hidden" aria-label="Menyu">
            <Menu className="h-5 w-5" />
          </button>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="hidden rounded-lg p-2 text-muted hover:bg-surface-2 xl:block"
            aria-label={collapsed ? 'Panelni ochish' : 'Panelni yigʻish'}
          >
            <PanelToggle className="h-5 w-5" open={!collapsed} />
          </button>
          <h1 className="truncate text-sm font-semibold">{current?.label ?? appName}</h1>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main className="p-4 md:p-8">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
