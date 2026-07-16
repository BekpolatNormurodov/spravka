import { prisma } from '@/lib/prisma';
import {
  dmy, formatSum, groupByDay, isoDay, isoMonth, isValidMonth, monthRange, shiftMonth,
} from '@spravka/shared/core';
import { Calendar, PageHeader, EmptyState, StatusBadge, ClickableRow, ViewAction } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

type SP = { month?: string; day?: string };

export default async function Kalendar({ searchParams }: { searchParams: SP }) {
  const now = new Date();
  const todayIso = isoDay(now);
  const month = isValidMonth(searchParams.month) ? searchParams.month : isoMonth(now);
  const day = searchParams.day;
  const { gte, lt } = monthRange(month);

  const [monthRows, dayCerts] = await Promise.all([
    prisma.certificate.findMany({
      where: { deletedAt: null, issueDate: { gte, lt } },
      select: { issueDate: true, status: true },
    }),
    day
      ? prisma.certificate.findMany({
          where: {
            deletedAt: null,
            issueDate: { gte: new Date(`${day}T00:00:00.000Z`), lte: new Date(`${day}T23:59:59.999Z`) },
          },
          include: { firm: { select: { shortName: true, name: true } }, createdBy: { select: { fullName: true } } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const days = groupByDay(monthRows.map((r) => ({ date: r.issueDate, status: r.status })));
  const total = monthRows.length;

  const href = (m: string, d?: string) => `/kalendar?month=${m}${d ? `&day=${d}` : ''}`;

  return (
    <div>
      <PageHeader title="Kalendar" subtitle={`Shu oyda ${total} ta maʼlumotnoma`} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Calendar
          month={month}
          days={days}
          selected={day}
          todayIso={todayIso}
          hrefForDay={(iso) => href(month, iso)}
          prevHref={href(shiftMonth(month, -1))}
          nextHref={href(shiftMonth(month, 1))}
          todayHref={href(isoMonth(now), todayIso)}
        />

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold">
            {day ? `${dmy(new Date(`${day}T00:00:00.000Z`))} — ${dayCerts.length} ta` : 'Kun tanlang'}
          </h2>

          {!day ? (
            <EmptyState title="Kun tanlanmagan" hint="Kalendardan kunni bosing." />
          ) : dayCerts.length === 0 ? (
            <EmptyState title="Bu kunda ariza yoʻq" />
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <tbody>
                  {dayCerts.map((c) => (
                    <ClickableRow key={c.id} href={`/arizalar/${c.id}`}>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs tabular-nums text-muted">{c.number}</div>
                        <div className="mt-0.5 font-medium">{c.personFullName}</div>
                        <div className="mt-1 flex items-center gap-2">
                          <StatusBadge status={c.status} />
                          <span className="text-xs text-muted">{c.firm.shortName ?? c.firm.name}</span>
                        </div>
                        <div className="mt-1 text-xs tabular-nums text-muted">
                          {formatSum(c.loanAmount.toString())} soʻm · {c.createdBy.fullName}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right align-top">
                        <ViewAction href={`/arizalar/${c.id}`} />
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
