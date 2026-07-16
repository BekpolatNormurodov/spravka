import { prisma } from '@/lib/prisma';
import {
  CertStatus, dmy, formatSum, parseCertFilters, buildCertWhere, pageSlice, pageHref, PER_PAGE,
  type CertFilterParams,
} from '@spravka/shared/core';
import { PageHeader, EmptyState, ClickableRow, Filters, Pagination, ContractCell } from '@spravka/shared/ui';
import { RowActions } from '@/components/RowActions';

export const dynamic = 'force-dynamic';

export default async function Imzolash({ searchParams }: { searchParams: CertFilterParams }) {
  // Status is fixed on this queue → no status filter offered.
  const p = parseCertFilters(searchParams, []);
  const where = { status: CertStatus.DIRECTOR_REVIEW, deletedAt: null, ...buildCertWhere(p) };

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
      <PageHeader title="Imzolash navbati" subtitle={`Imzo kutmoqda: ${total} ta`} />
      <Filters firms={firms} />

      {certs.length === 0 ? (
        <EmptyState title="Imzolash uchun ariza yoʻq" hint="Admin tasdiqlagach shu yerda paydo boʻladi." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              {/* Passport under the person, yurist under the date — keeps all nine columns'
                  data inside ~924px instead of scrolling at 1060px. */}
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[12%]" />
                  <col className="w-[25%]" />
                  <col className="w-[15%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[13%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">№</th>
                    <th className="px-4 py-3 text-left font-medium">Jismoniy shaxs</th>
                    <th className="px-4 py-3 text-left font-medium">Firma</th>
                    <th className="px-4 py-3 text-left font-medium">Shartnoma</th>
                    <th className="px-3 py-3 text-right font-medium">Summa</th>
                    <th className="px-3 py-3 text-left font-medium">Sana</th>
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
                      <td className="px-2 py-3 align-top"><RowActions id={c.id} number={c.number} /></td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={p.page} pages={pages} total={total} perPage={PER_PAGE} hrefFor={(n) => pageHref('/imzolash', p, n)} />
        </>
      )}
    </div>
  );
}
