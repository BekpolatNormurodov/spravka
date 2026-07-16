import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CertStatus, STATUS_LABELS } from '@spravka/shared/core';

export const dynamic = 'force-dynamic';

const CARDS: { status: CertStatus; tone: string }[] = [
  { status: CertStatus.DRAFT, tone: 'text-fg' },
  { status: CertStatus.ADMIN_REVIEW, tone: 'text-amber-600 dark:text-amber-300' },
  { status: CertStatus.DIRECTOR_REVIEW, tone: 'text-violet-600 dark:text-violet-300' },
  { status: CertStatus.SIGNED, tone: 'text-accent-600 dark:text-accent-400' },
];

export default async function Monitoring() {
  const [grouped, firms, users, recent] = await Promise.all([
    prisma.certificate.groupBy({ by: ['status'], where: { deletedAt: null }, _count: { _all: true } }),
    prisma.firm.count({ where: { isActive: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.certificate.count({ where: { deletedAt: null } }),
  ]);
  const countOf = (s: CertStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Monitoring</h1>
      <p className="text-sm text-muted mb-6">Umumiy holat va statistika</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {CARDS.map((c) => (
          <Link key={c.status} href="/imzolash" className="card p-5 hover:border-brand-500/30 transition">
            <div className={`text-3xl font-bold ${c.tone}`}>{countOf(c.status)}</div>
            <div className="mt-1 text-sm text-muted">{STATUS_LABELS[c.status]}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card p-5"><div className="text-2xl font-bold">{recent}</div><div className="text-sm text-muted mt-1">Jami arizalar</div></div>
        <div className="card p-5"><div className="text-2xl font-bold">{firms}</div><div className="text-sm text-muted mt-1">Faol firmalar</div></div>
        <div className="card p-5"><div className="text-2xl font-bold">{users}</div><div className="text-sm text-muted mt-1">Foydalanuvchilar</div></div>
      </div>
    </div>
  );
}
