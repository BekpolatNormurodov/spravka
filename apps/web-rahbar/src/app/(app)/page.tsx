import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CertStatus, STATUS_LABELS, formatSum, isoMonth, shiftMonth } from '@spravka/shared/core';
import {
  PageHeader, StatCard, BarChart, DonutChart, UZ_MONTHS_LAT, type Series,
} from '@spravka/shared/ui';
import { DashFilters } from './DashFilters';
import { requireRahbarFirmId } from '@/lib/scope';

export const dynamic = 'force-dynamic';

type SP = { months?: string; from?: string; to?: string };

// Hex values — SVG needs real colours, and these match the status dots/badges.
const TONE = {
  [CertStatus.DRAFT]: '#94a3b8',
  [CertStatus.ADMIN_REVIEW]: '#f59e0b',
  [CertStatus.DIRECTOR_REVIEW]: '#8b5cf6',
  [CertStatus.SIGNED]: '#10b981',
} as const;

export default async function Monitoring({ searchParams }: { searchParams: SP }) {
  const months = Math.min(24, Math.max(6, Number(searchParams.months ?? '12') || 12));
  // Not from searchParams: a rahbar monitors their own firm and cannot widen the view.
  const firmId = await requireRahbarFirmId();
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
    firmId,
    issueDate: dateFilter,
  };

  const [rows, grouped] = await Promise.all([
    prisma.certificate.findMany({
      where,
      select: { issueDate: true, status: true, signedAt: true, loanAmount: true },
    }),
    prisma.certificate.groupBy({ by: ['status'], where, _count: { _all: true } }),
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

  return (
    <div>
      <PageHeader title="Monitoring" subtitle={`Tanlangan davrda ${total} ta maʼlumotnoma`} />
      {/* No firm control: the page is one firm by definition. The «Firmalar boʻyicha» breakdown
          went with it — a chart comparing one firm to itself. */}
      <DashFilters />

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

        <section className="card p-5">
          <h3 className="mb-4 text-sm font-semibold">Tezkor havolalar</h3>
          <div className="space-y-2">
            <Link href="/imzolash" className="btn-ghost w-full justify-between">
              Imzo kutmoqda <span className="font-semibold tabular-nums">{countOf(CertStatus.DIRECTOR_REVIEW)}</span>
            </Link>
            <Link href="/imzolangan" className="btn-ghost w-full justify-between">
              Imzolangan <span className="font-semibold tabular-nums">{signed}</span>
            </Link>
            <Link href="/kalendar" className="btn-ghost w-full justify-between">Kalendar</Link>
            <Link href="/mijozlar" className="btn-ghost w-full justify-between">Mijozlar</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
