import Link from 'next/link';
import { Prisma } from '@spravka/shared/db';
import { prisma } from '@/lib/prisma';
import { CertStatus, dmy, formatSum } from '@spravka/shared/core';
import { StatusBadge, PageHeader, EmptyState, ClickableRow, ViewAction } from '@spravka/shared/ui';
import { Filters } from './Filters';

export const dynamic = 'force-dynamic';

const PER_PAGE = 20;

type SP = { q?: string; status?: string; firm?: string; from?: string; to?: string; page?: string };

export default async function Arizalar({ searchParams }: { searchParams: SP }) {
  const q = searchParams.q?.trim();
  const status = searchParams.status as CertStatus | undefined;
  const firmId = searchParams.firm;
  const from = searchParams.from;
  const to = searchParams.to;
  const page = Math.max(1, Number(searchParams.page ?? '1') || 1);

  const where: Prisma.CertificateWhereInput = {
    deletedAt: null,
    ...(status && Object.values(CertStatus).includes(status) ? { status } : {}),
    ...(firmId ? { firmId } : {}),
    ...(from || to
      ? {
          issueDate: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q } },
            { personFullName: { contains: q } },
            { personPassport: { contains: q } },
            { contractNumber: { contains: q } },
          ],
        }
      : {}),
  };

  const [firms, total, certs] = await Promise.all([
    prisma.firm.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, shortName: true } }),
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      include: { firm: { select: { shortName: true, name: true } }, createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (status) sp.set('status', status);
    if (firmId) sp.set('firm', firmId);
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return s ? `/arizalar?${s}` : '/arizalar';
  };

  return (
    <div>
      <PageHeader title="Arizalar" subtitle={`Topildi: ${total} ta`} />

      <Filters firms={firms} />

      {certs.length === 0 ? (
        <EmptyState title="Ariza topilmadi" hint="Filtrlarni oʻzgartirib koʻring." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">№</th>
                    <th className="px-4 py-3 text-left font-medium">Jismoniy shaxs</th>
                    <th className="px-4 py-3 text-left font-medium">Passport</th>
                    <th className="px-4 py-3 text-left font-medium">Firma</th>
                    <th className="px-4 py-3 text-left font-medium">Shartnoma</th>
                    <th className="px-4 py-3 text-right font-medium">Summa (soʻm)</th>
                    <th className="px-4 py-3 text-left font-medium">Yurist</th>
                    <th className="px-4 py-3 text-left font-medium">Sana</th>
                    <th className="px-4 py-3 text-left font-medium">Holat</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => (
                    <ClickableRow key={c.id} href={`/arizalar/${c.id}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-fg">{c.number}</td>
                      <td className="px-4 py-3 font-medium">{c.personFullName}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{c.personPassport}</td>
                      <td className="px-4 py-3 text-fg">{c.firm.shortName ?? c.firm.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">
                        {c.contractNumber}
                        <span className="ml-1.5 text-[11px] text-muted">· {dmy(c.contractDate)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                        {formatSum(c.loanAmount.toString())}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{c.createdBy.fullName}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{dmy(c.issueDate)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <ViewAction href={`/arizalar/${c.id}`} />
                      </td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-3" aria-label="Sahifalash">
              <p className="text-xs text-muted">
                {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} / {total}
              </p>
              <div className="flex items-center gap-1">
                {page > 1 ? (
                  <Link href={qs(page - 1)} className="btn-ghost px-3 py-1.5 text-xs">← Oldingi</Link>
                ) : (
                  <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs opacity-40">← Oldingi</span>
                )}
                <span className="px-3 text-xs text-muted tabular-nums">{page} / {pages}</span>
                {page < pages ? (
                  <Link href={qs(page + 1)} className="btn-ghost px-3 py-1.5 text-xs">Keyingi →</Link>
                ) : (
                  <span className="btn-ghost pointer-events-none px-3 py-1.5 text-xs opacity-40">Keyingi →</span>
                )}
              </div>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
