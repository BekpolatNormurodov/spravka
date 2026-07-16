import { prisma } from '@/lib/prisma';
import {
  CertStatus, dmy, formatSum, parseCertFilters, buildCertWhere, pageSlice, pageHref, PER_PAGE,
  type CertFilterParams,
} from '@spravka/shared/core';
import { PageHeader, EmptyState, ClickableRow, StatusBadge, Filters, Pagination, ContractCell } from '@spravka/shared/ui';
import { RowActions } from '@/components/RowActions';
import { requireRahbarFirmId } from '@/lib/scope';

export const dynamic = 'force-dynamic';

export default async function Imzolangan({ searchParams }: { searchParams: CertFilterParams }) {
  // Status is fixed (SIGNED) → no status filter offered.
  const p = parseCertFilters(searchParams, []);
  // firmId last: this scope is not a filter the user may widen.
  const where = {
    status: CertStatus.SIGNED,
    deletedAt: null,
    ...buildCertWhere(p),
    firmId: await requireRahbarFirmId(),
  };

  const [total, certs] = await Promise.all([
    prisma.certificate.count({ where }),
    prisma.certificate.findMany({
      where,
      include: { contracts: { orderBy: { order: 'asc' } }, firm: { select: { shortName: true, name: true } }, signedBy: { select: { fullName: true } } },
      orderBy: { signedAt: 'desc' },
      ...pageSlice(p.page),
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div>
      <PageHeader title="Imzolangan maʼlumotnomalar" subtitle={`Topildi: ${total} ta · publicʼda koʻrinadi`} />
      {/* No firm filter: a rahbar has exactly one, so the control could only ever be a no-op. */}
      <Filters />

      {certs.length === 0 ? (
        <EmptyState title="Imzolangan maʼlumotnoma topilmadi" hint="Imzolagach shu yerda toʻplanadi." />
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              {/* Passport under the person, signer under the sign date — ten columns needed
                  1060px against ~924px of room. table-fixed holds each share. */}
              <table className="w-full min-w-[860px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[11%]" />
                  <col className="w-[22%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[9%]" />
                </colgroup>
                <thead className="bg-surface-2 text-muted">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium">№</th>
                    <th className="px-4 py-3 text-left font-medium">Jismoniy shaxs</th>
                    <th className="px-3 py-3 text-left font-medium">Firma</th>
                    <th className="px-3 py-3 text-left font-medium">Shartnoma</th>
                    <th className="px-3 py-3 text-right font-medium">Summa</th>
                    <th className="px-3 py-3 text-left font-medium">Imzolangan</th>
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
                        <div className="truncate tabular-nums">{c.signedAt ? dmy(c.signedAt) : '—'}</div>
                        <div className="truncate text-xs" title={c.signedBy?.fullName}>{c.signedBy?.fullName ?? '—'}</div>
                      </td>
                      <td className="px-2 py-3 align-top"><StatusBadge status={c.status} /></td>
                      <td className="px-2 py-3 align-top"><RowActions id={c.id} number={c.number} /></td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination page={p.page} pages={pages} total={total} perPage={PER_PAGE} hrefFor={(n) => pageHref('/imzolangan', p, n)} />
        </>
      )}
    </div>
  );
}
