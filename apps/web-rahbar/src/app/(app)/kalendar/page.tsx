import { prisma } from '@/lib/prisma';
import {
  dmy, formatSum, groupByDay, isoDay, isoMonth, isValidDay, isValidMonth, monthRange,
  sameDayInMonth, shiftMonth,
} from '@spravka/shared/core';
import { Calendar, PageHeader, EmptyState, StatusBadge, ClickableRow, ViewAction } from '@spravka/shared/ui';
import { requireRahbarFirmId } from '@/lib/scope';

export const dynamic = 'force-dynamic';

type SP = { month?: string; day?: string };

export default async function Kalendar({ searchParams }: { searchParams: SP }) {
  const now = new Date();
  const todayIso = isoDay(now);
  const month = isValidMonth(searchParams.month) ? searchParams.month : isoMonth(now);

  // A day is always selected: today when you land on the current month, otherwise the 1st.
  // ?day is honoured only when it belongs to the month on screen — a stale pair would show
  // one month's grid next to another month's list.
  const day =
    isValidDay(searchParams.day) && searchParams.day.startsWith(`${month}-`)
      ? searchParams.day
      : month === isoMonth(now)
        ? todayIso
        : `${month}-01`;

  const { gte, lt } = monthRange(month);
  const firmId = await requireRahbarFirmId();

  const [monthRows, dayCerts] = await Promise.all([
    prisma.certificate.findMany({
      where: { deletedAt: null, firmId, issueDate: { gte, lt } },
      select: { issueDate: true, status: true },
    }),
    prisma.certificate.findMany({
      where: {
        deletedAt: null,
        firmId,
        issueDate: { gte: new Date(`${day}T00:00:00.000Z`), lte: new Date(`${day}T23:59:59.999Z`) },
      },
      include: { firm: { select: { shortName: true, name: true } }, createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const days = groupByDay(monthRows.map((r) => ({ date: r.issueDate, status: r.status })));
  const total = monthRows.length;

  const href = (m: string, d: string) => `/kalendar?month=${m}&day=${d}`;
  // Stepping a month keeps the day-of-month, so the side list never empties on arrow-through.
  const dayNum = Number(day.slice(-2));
  const stepHref = (delta: number) => {
    const m = shiftMonth(month, delta);
    return href(m, sameDayInMonth(m, dayNum));
  };

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
          prevHref={stepHref(-1)}
          nextHref={stepHref(1)}
          todayHref={href(isoMonth(now), todayIso)}
        />

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold">
            {dmy(new Date(`${day}T00:00:00.000Z`))} — {dayCerts.length} ta
          </h2>

          {dayCerts.length === 0 ? (
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
