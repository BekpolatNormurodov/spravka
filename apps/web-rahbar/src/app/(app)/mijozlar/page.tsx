import { prisma } from '@/lib/prisma';
import { dmy, PER_PAGE, pageSlice } from '@spravka/shared/core';
import { PageHeader, EmptyState } from '@spravka/shared/ui';
import { ClientSearch } from './ClientSearch';

export const dynamic = 'force-dynamic';

type SP = { q?: string; page?: string };

export default async function Mijozlar({ searchParams }: { searchParams: SP }) {
  const q = searchParams.q?.trim();
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);

  const where = q
    ? { OR: [{ pinfl: { contains: q } }, { fullName: { contains: q } }, { passport: { contains: q } }] }
    : {};

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({
      where,
      include: { _count: { select: { certificates: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageSlice(page),
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const href = (p: number) => `/mijozlar?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { page: String(p) } : {}) })}`;

  return (
    <div>
      <PageHeader title="Mijozlar" subtitle={`${total} ta jismoniy shaxs · PINFL boʻyicha aniqlanadi`} />
      <ClientSearch />

      {clients.length === 0 ? (
        <EmptyState title="Mijoz topilmadi" hint="Yurist ariza kiritganda mijoz avtomatik qoʻshiladi." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">PINFL</th>
                    <th className="px-4 py-3 text-left font-medium">F.I.SH.</th>
                    <th className="px-4 py-3 text-left font-medium">Passport</th>
                    <th className="px-4 py-3 text-left font-medium">Kim bergan</th>
                    <th className="px-4 py-3 text-right font-medium">Arizalar</th>
                    <th className="px-4 py-3 text-left font-medium">Qoʻshilgan</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-t border-line transition-colors hover:bg-surface-2">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-fg">{c.pinfl}</td>
                      <td className="px-4 py-3 font-medium">{c.fullName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{c.passport}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {c.passportIssuedBy ?? '—'}
                        {c.passportIssuedAt && <div className="tabular-nums">{dmy(c.passportIssuedAt)}</div>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{c._count.certificates}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{dmy(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Sahifalash">
              <p className="text-xs tabular-nums text-muted">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} / {total}
              </p>
              <div className="flex items-center gap-1">
                {page > 1 ? <a href={href(page - 1)} className="btn-ghost px-3 py-1.5 text-xs">← Oldingi</a> : <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs opacity-40">← Oldingi</span>}
                <span className="px-3 text-xs tabular-nums text-muted">{page} / {pages}</span>
                {page < pages ? <a href={href(page + 1)} className="btn-ghost px-3 py-1.5 text-xs">Keyingi →</a> : <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs opacity-40">Keyingi →</span>}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
