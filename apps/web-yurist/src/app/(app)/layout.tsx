import { redirect } from 'next/navigation';
import { AppShell, type NavItem, type NavPanel } from '@spravka/shared/ui';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

const NAV: NavItem[] = [
  { href: '/', label: 'Boshqaruv', icon: 'dashboard', section: 'Menyu' },
  { href: '/arizalar/yangi', label: 'Yangi ariza', icon: 'file-plus', section: 'Menyu' },
  { href: '/kalendar', label: 'Kalendar', icon: 'calendar', section: 'Menyu' },
  { href: '/mijozlar', label: 'Mijozlar', icon: 'user', section: 'Menyu' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  // Firms are loaded for the whole (app) tree rather than in the page, because the sidebar is
  // where they are chosen — a new ariza starts by picking the blank, and the blank is the firm.
  const firms = await prisma.firm.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, shortName: true },
  });

  const panel: NavPanel = {
    match: '/arizalar/yangi',
    title: 'Firmani tanlang',
    back: { href: '/', label: 'Orqaga' },
    emptyLabel: 'Faol firma yoʻq — administratorga murojaat qiling.',
    items: firms.map((f) => ({
      href: `/arizalar/yangi/${f.id}`,
      label: f.shortName ?? f.name,
      icon: 'building',
    })),
  };

  return (
    <AppShell
      appName="Yurist paneli"
      nav={NAV}
      panel={panel}
      user={{ fullName: session.fullName, roleLabel: 'Yurist' }}
    >
      {children}
    </AppShell>
  );
}
