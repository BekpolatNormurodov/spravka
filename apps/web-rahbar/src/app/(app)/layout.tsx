import { redirect } from 'next/navigation';
import { AppShell, type NavItem } from '@spravka/shared/ui';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { CertStatus } from '@spravka/shared/core';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const queue = await prisma.certificate.count({
    where: { status: CertStatus.DIRECTOR_REVIEW, deletedAt: null },
  });

  const nav: NavItem[] = [
    { href: '/', label: 'Monitoring', icon: 'chart', section: 'Menyu' },
    { href: '/imzolash', label: 'Imzolash', icon: 'pen', badge: queue, section: 'Menyu' },
    { href: '/imzolangan', label: 'Imzolangan', icon: 'check', section: 'Menyu' },
    { href: '/kalendar', label: 'Kalendar', icon: 'calendar', section: 'Menyu' },
    { href: '/mijozlar', label: 'Mijozlar', icon: 'user', section: 'Menyu' },
  ];

  return (
    <AppShell
      appName="Rahbar paneli"
      initials="R"
      accentClass="bg-violet-600"
      nav={nav}
      user={{ fullName: session.fullName, roleLabel: 'Ijrochi direktor' }}
    >
      {children}
    </AppShell>
  );
}
