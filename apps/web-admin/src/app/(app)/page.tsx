import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CertStatus, STATUS_LABELS, formatSum, isoMonth, shiftMonth } from '@spravka/shared/core';
import {
  PageHeader, StatCard, BarChart, DonutChart, HBarChart, UZ_MONTHS_LAT, type Series,
} from '@spravka/shared/ui';
import { DashFilters } from './DashFilters';

export const dynamic = 'force-dynamic';

type SP = { months?: string; firm?: string; from?: string; to?: string };

// Hex values — SVG needs real colours, and these match the status dots/badges.
const TONE = {
  [CertStatus.DRAFT]: '#94a3b8',
  [CertStatus.ADMIN_REVIEW]: '#f59e0b',
  [CertStatus.DIRECTOR_REVIEW]: '#8b5cf6',
  [CertStatus.SIGNED]: '#10b981',
} as const;

export default async function Monitoring({ searchParams }: { searchParams: SP }) {
  const months = Math.min(24, Math.max(6, Number(searchParams.months ?? '12') || 12));
  const firmId = searchParams.firm || undefined;
  const from = searchParams.from;
  const to = searchParams.to;

  const now = new Date();
  const startMonth = shiftMonth(isoMonth(now), -(months - 1));
  const [sy, sm] = startMonth.split('-').map(Number);
  const windowStart = new Date(Date.UTC(sy!, sm! - 1, 1));

  const dateFilter = {
    gte: from ? new Date(from) : windowStart,
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };

  const where = {
    deletedAt: null,
    ...(firmId ? { firmId } : {}),
    issueDate: dateFilter,
  };

  const [rows, firms, grouped, users, byFirm] = await Promise.all([
    prisma.certificate.findMany({
      where,
      select: { issueDate: true, status: true, signedAt: true, loanAmount: true },
    }),
    prisma.firm.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, shortName: true } }),
    prisma.certificate.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.user.count({ where: { isActive: true } }),
    prisma.certificate.groupBy({ by: ['firmId'], where, _count: { _all: true } }),
  ]);

  const countOf = (s: CertStatus) => grouped.find((g) => g.status === s)?._count._all ?? 0;
  const total = rows.length;
  const signed = countOf(CertStatus.SIGNED);
  const sum = rows.reduce((a, r) => a + Number(r.loanAmount), 0);

  // Month buckets for the trend.
  const buckets: string[] = [];
  for (let i = months - 1; i >= 0; i--) buckets.push(shiftMonth(isoMonth(now), -i));
  const issuedByMonth = new Array(buckets.length).fill(0);
  const signedByMonth = new Array(buckets.length).fill(0);
  for (const r of rows) {
    const i = buckets.indexOf(isoMonth(r.issueDate));
    if (i >= 0) issuedByMonth[i] += 1;
    if (r.signedAt) {
      const j = buckets.indexOf(isoMonth(r.signedAt));
      if (j >= 0) signedByMonth[j] += 1;
    }
  }
  const labels = buckets.map((b) => {
    const m = Number(b.split('-')[1]);
    return UZ_MONTHS_LAT[m - 1]!.slice(0, 3);
  });

  const series: Series[] = [
    { label: 'Kiritilgan', color: '#2563eb', values: issuedByMonth },
    { label: 'Imzolangan', color: '#10b981', values: signedByMonth },
  ];

  const firmRows = byFirm
    .map((g) => ({
      label: firms.find((f) => f.id === g.firmId)?.shortName ?? firms.find((f) => f.id === g.firmId)?.name ?? '—',
      value: g._count._all,
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <PageHeader title="Monitoring" subtitle={`Tanlangan davrda ${total} ta maʼlumotnoma`} />
      <DashFilters firms={firms} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard value={total} label="Jami arizalar" />
        <StatCard value={signed} label="Imzolangan" tone="text-accent-600 dark:text-accent-400" />
        <StatCard value={countOf(CertStatus.ADMIN_REVIEW) + countOf(CertStatus.DIRECTOR_REVIEW)} label="Jarayonda" tone="text-amber-600 dark:text-amber-300" />
        <StatCard value={`${formatSum(String(Math.round(sum)))}`} label="Umumiy summa (soʻm)" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <BarChart
            title="Oylar boʻyicha dinamika"
            subtitle="Kiritilgan va imzolangan maʼlumotnomalar"
            categories={labels}
            series={series}
          />
        </div>

        <DonutChart
          title="Holatlar"
          subtitle="Tanlangan davr kesimida"
          slices={[CertStatus.DRAFT, CertStatus.ADMIN_REVIEW, CertStatus.DIRECTOR_REVIEW, CertStatus.SIGNED].map((s) => ({
            label: STATUS_LABELS[s],
            value: countOf(s),
            color: TONE[s],
          }))}
        />

        <div className="xl:col-span-2">
          <HBarChart title="Firmalar boʻyicha" subtitle="Maʼlumotnomalar soni" rows={firmRows} />
        </div>

        <section className="card p-5">
          <h3 className="mb-4 text-sm font-semibold">Tezkor havolalar</h3>
          <div className="space-y-2">
            <Link href="/arizalar?status=ADMIN_REVIEW" className="btn-ghost w-full justify-between">
              Koʻrikdagi arizalar <span className="font-semibold tabular-nums">{countOf(CertStatus.ADMIN_REVIEW)}</span>
            </Link>
            <Link href="/mijozlar" className="btn-ghost w-full justify-between">Mijozlar</Link>
            <Link href="/firmalar" className="btn-ghost w-full justify-between">
              Firmalar <span className="font-semibold tabular-nums">{firms.length}</span>
            </Link>
            <Link href="/foydalanuvchilar" className="btn-ghost w-full justify-between">
              Foydalanuvchilar <span className="font-semibold tabular-nums">{users}</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
