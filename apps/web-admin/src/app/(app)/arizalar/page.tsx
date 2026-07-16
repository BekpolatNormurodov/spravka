import { prisma } from '@/lib/prisma';
import {
  CertStatus, dmy, formatSum, parseCertFilters, buildCertWhere, pageSlice, pageHref, PER_PAGE,
  type CertFilterParams,
} from '@spravka/shared/core';
import {
  StatusBadge, PageHeader, EmptyState, ClickableRow, ViewAction, Filters, Pagination,
} from '@spravka/shared/ui';

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
      include: { firm: { select: { shortName: true, name: true } }, createdBy: { select: { fullName: true } } },
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
                        <span className="ml-1.5 text-[11px]">· {dmy(c.contractDate)}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                        {formatSum(c.loanAmount.toString())}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{c.createdBy.fullName}</td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{dmy(c.issueDate)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-right"><ViewAction href={`/arizalar/${c.id}`} /></td>
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
