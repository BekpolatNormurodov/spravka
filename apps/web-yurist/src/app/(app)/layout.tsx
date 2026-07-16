import { redirect } from 'next/navigation';
import { AppShell, type NavItem } from '@spravka/shared/ui';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NAV: NavItem[] = [
  { href: '/', label: 'Boshqaruv', icon: 'dashboard', section: 'Menyu' },
  { href: '/arizalar/yangi', label: 'Yangi ariza', icon: 'file-plus', section: 'Menyu' },
  { href: '/kalendar', label: 'Kalendar', icon: 'calendar', section: 'Menyu' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    <AppShell
      appName="Yurist paneli"
      initials="Y"
      accentClass="bg-brand-600"
      nav={NAV}
      user={{ fullName: session.fullName, roleLabel: 'Yurist' }}
    >
      {children}
    </AppShell>
  );
}
