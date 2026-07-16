import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import {
  CertStatus, dmy, formatSum, parseCertFilters, buildCertWhere, pageSlice, pageHref, PER_PAGE,
  type CertFilterParams,
} from '@spravka/shared/core';
import {
  StatusBadge, PageHeader, EmptyState, ClickableRow, ViewAction, Filters, Pagination, ContractCell } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

const STATUSES = [CertStatus.DRAFT, CertStatus.ADMIN_REVIEW, CertStatus.DIRECTOR_REVIEW, CertStatus.SIGNED] as const;

export default async function Dashboard({ searchParams }: { searchParams: CertFilterParams }) {
  const session = await getSession();
  const p = parseCertFilters(searchParams, STATUSES);
  const where = { createdById: session!.sub, deletedAt: null, ...buildCertWhere(p) };

  const [firms, total, certs] = await Promise.all([
    prisma.firm.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, shortName: true } }),
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      include: {
        contracts: { orderBy: { order: 'asc' } },
        firm: { select: { shortName: true, name: true } },
        events: { where: { action: 'RETURN' }, orderBy: { createdAt: 'desc' }, take: 1, select: { note: true } },
      },
      orderBy: { createdAt: 'desc' },
      ...pageSlice(p.page),
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader
        title="Mening arizalarim"
        subtitle={`Topildi: ${total} ta`}
        action={<Link href="/arizalar/yangi" className="btn-primary">+ Yangi ariza</Link>}
      />

      <Filters firms={firms} statuses={STATUSES} />

      {certs.length === 0 ? (
        <EmptyState
          title="Ariza topilmadi"
          hint={<Link href="/arizalar/yangi" className="text-brand-600 hover:underline dark:text-brand-400">Yangi ariza yarating</Link>}
        />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              {/* Passport under the person — nine columns needed 1040px against ~924px of
                  room. table-fixed holds each share. */}
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[11%]" />
                  <col className="w-[25%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">№</th>
                    <th className="px-4 py-3 text-left font-medium">Jismoniy shaxs</th>
                    <th className="px-3 py-3 text-left font-medium">Firma</th>
                    <th className="px-3 py-3 text-left font-medium">Shartnoma</th>
                    <th className="px-3 py-3 text-right font-medium">Summa</th>
                    <th className="px-3 py-3 text-left font-medium">Sana</th>
                    <th className="px-2 py-3 text-left font-medium">Holat</th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => {
                    const back = c.status === CertStatus.DRAFT && c.events[0]?.note;
                    return (
                      <ClickableRow key={c.id} href={`/arizalar/${c.id}`}>
                        <td className="px-3 py-3 align-top">
                          <div className="truncate font-mono text-xs tabular-nums text-fg" title={c.number}>{c.number}</div>
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-medium" title={c.personFullName}>{c.personFullName}</span>
                            {back && (
                              <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                                qaytarilgan
                              </span>
                            )}
                          </div>
                          <div className="truncate font-mono text-xs text-muted">{c.personPassport}</div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="truncate text-fg" title={c.firm.name}>{c.firm.shortName ?? c.firm.name}</div>
                        </td>
                        <td className="px-3 py-3 align-top">
                          <div className="font-mono text-xs text-muted"><ContractCell contracts={c.contracts} /></div>
                        </td>
                        <td className="px-3 py-3 align-top text-right">
                          <div className="truncate font-semibold tabular-nums">{formatSum(c.loanAmount.toString())}</div>
                        </td>
                        <td className="px-3 py-3 align-top text-muted">
                          <div className="truncate tabular-nums">{dmy(c.issueDate)}</div>
                        </td>
                        <td className="px-2 py-3 align-top"><StatusBadge status={c.status} /></td>
                        <td className="px-2 py-3 text-right align-top"><ViewAction href={`/arizalar/${c.id}`} /></td>
                      </ClickableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={p.page} pages={pages} total={total} perPage={PER_PAGE} hrefFor={(n) => pageHref('/', p, n)} />
        </>
      )}
    </div>
  );
}
