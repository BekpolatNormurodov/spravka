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
    where: { status: CertStatus.ADMIN_REVIEW, deletedAt: null },
  });

  const nav: NavItem[] = [
    { href: '/', label: 'Monitoring', icon: 'chart', section: 'Menyu' },
    { href: '/arizalar', label: 'Arizalar', icon: 'files', badge: queue, section: 'Menyu' },
    { href: '/kalendar', label: 'Kalendar', icon: 'calendar', section: 'Menyu' },
    { href: '/firmalar', label: 'Firmalar', icon: 'building', section: 'Boshqaruv' },
    { href: '/foydalanuvchilar', label: 'Foydalanuvchilar', icon: 'users', section: 'Boshqaruv' },
  ];

  return (
    <AppShell
      appName="Admin paneli"
      initials="A"
      accentClass="bg-brand-600"
      nav={nav}
      user={{ fullName: session.fullName, roleLabel: 'Administrator' }}
    >
      {children}
    </AppShell>
  );
}
