import { prisma } from '@/lib/prisma';
import {
  CertStatus, dmy, formatSum, parseCertFilters, buildCertWhere, pageSlice, pageHref, PER_PAGE,
  type CertFilterParams,
} from '@spravka/shared/core';
import {
  StatusBadge, PageHeader, EmptyState, ClickableRow, ViewAction, Filters, Pagination, ContractCell } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

const STATUSES = [CertStatus.DRAFT, CertStatus.ADMIN_REVIEW, CertStatus.DIRECTOR_REVIEW, CertStatus.SIGNED] as const;

export default async function Arizalar({ searchParams }: { searchParams: CertFilterParams }) {
  const p = parseCertFilters(searchParams, STATUSES);
  const where = { deletedAt: null, ...buildCertWhere(p) };

  const [firms, total, certs] = await Promise.all([
    prisma.firm.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, shortName: true } }),
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      include: { contracts: { orderBy: { order: 'asc' } }, firm: { select: { shortName: true, name: true } }, createdBy: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      ...pageSlice(p.page),
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader title="Arizalar" subtitle={`Topildi: ${total} ta`} />
      <Filters firms={firms} statuses={STATUSES} />

      {certs.length === 0 ? (
        <EmptyState title="Ariza topilmadi" hint="Filtrlarni oʻzgartirib koʻring." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              {/* Passport rides under the person, yurist under the date — ten columns needed
                  1180px against ~924px of room. table-fixed holds each share. */}
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[11%]" />
                  <col className="w-[23%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[5%]" />
                </colgroup>
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">№</th>
                    <th className="px-4 py-3 text-left font-medium">Jismoniy shaxs</th>
                    <th className="px-4 py-3 text-left font-medium">Firma</th>
                    <th className="px-4 py-3 text-left font-medium">Shartnoma</th>
                    <th className="px-3 py-3 text-right font-medium">Summa</th>
                    <th className="px-3 py-3 text-left font-medium">Sana</th>
                    <th className="px-2 py-3 text-left font-medium">Holat</th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {certs.map((c) => (
                    <ClickableRow key={c.id} href={`/arizalar/${c.id}`}>
                      <td className="px-3 py-3 align-top">
                        <div className="truncate font-mono text-xs tabular-nums text-fg" title={c.number}>{c.number}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="truncate font-medium" title={c.personFullName}>{c.personFullName}</div>
                        <div className="truncate font-mono text-xs text-muted">{c.personPassport}</div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="truncate text-fg" title={c.firm.name}>{c.firm.shortName ?? c.firm.name}</div>
                      </td>
                      <td className="px-4 py-3 align-top font-mono text-xs text-muted">
                        <ContractCell contracts={c.contracts} />
                      </td>
                      <td className="px-3 py-3 align-top text-right">
                        <div className="truncate font-semibold tabular-nums">{formatSum(c.loanAmount.toString())}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-muted">
                        <div className="truncate tabular-nums">{dmy(c.issueDate)}</div>
                        <div className="truncate text-xs" title={c.createdBy.fullName}>{c.createdBy.fullName}</div>
                      </td>
                      <td className="px-2 py-3 align-top"><StatusBadge status={c.status} /></td>
                      <td className="px-2 py-3 text-right align-top"><ViewAction href={`/arizalar/${c.id}`} /></td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={p.page} pages={pages} total={total} perPage={PER_PAGE} hrefFor={(n) => pageHref('/arizalar', p, n)} />
        </>
      )}
    </div>
  );
}
