import { prisma } from '@/lib/prisma';
import { maskAccount } from '@spravka/shared/core';
import { PageHeader, EmptyState } from '@spravka/shared/ui';
import { FirmForm } from './FirmForm';

export const dynamic = 'force-dynamic';

export default async function Firmalar() {
  const firms = await prisma.firm.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { certificates: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Firmalar"
        subtitle={`${firms.length} ta mikromoliya tashkiloti · har birida bitta ijrochi direktor`}
        action={<FirmForm />}
      />

      {firms.length === 0 ? (
        <EmptyState title="Firma yoʻq" hint="Birinchi firmani qoʻshing." />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            {/* Ten columns needed 1609px against ~915px of room. Same data, grouped into
                five: identity, people, bank, contact, state. table-fixed + truncate keeps
                every column inside its share instead of letting long names push the rest out. */}
            <table className="w-full min-w-[880px] table-fixed text-sm">
              {/* Shares must total 100 — a col left auto collapses to 0 and pushes the row wide. */}
              <colgroup>
                <col className="w-[23%]" />
                <col className="w-[20%]" />
                <col className="w-[17%]" />
                <col className="w-[16%]" />
                <col className="w-[9%]" />
                <col className="w-[9%]" />
                <col className="w-[6%]" />
              </colgroup>
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tashkilot</th>
                  <th className="px-4 py-3 text-left font-medium">Rahbariyat</th>
                  <th className="px-4 py-3 text-left font-medium">Bank / MFO</th>
                  <th className="px-4 py-3 text-left font-medium">Aloqa</th>
                  <th className="px-3 py-3 text-right font-medium">Arizalar</th>
                  <th className="px-3 py-3 text-left font-medium">Holat</th>
                  <th className="px-3 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.id} className="border-t border-line align-top transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="truncate font-medium" title={f.shortName ?? f.name}>{f.shortName ?? f.name}</div>
                      <div className="mt-0.5 truncate text-xs text-muted" title={f.name}>{f.name}</div>
                      {f.stir && <div className="mt-0.5 truncate font-mono text-xs tabular-nums text-muted">STIR {f.stir}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="truncate font-medium" title={f.directorFullName ?? f.directorName}>{f.directorName}</div>
                      <div className="truncate text-xs text-muted" title={f.directorPosition}>{f.directorPosition}</div>
                      {f.accountantName && (
                        <div className="mt-0.5 truncate text-xs text-muted" title={f.accountantName}>Bux: {f.accountantName}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {f.bankName ? (
                        <>
                          <div className="truncate text-fg" title={f.bankName}>{f.bankName}</div>
                          {f.bankAccount && (
                            <div className="truncate font-mono tabular-nums" title={maskAccount(f.bankAccount)}>{maskAccount(f.bankAccount)}</div>
                          )}
                          {f.mfo && <div className="truncate font-mono tabular-nums">MFO {f.mfo}</div>}
                        </>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div className="truncate tabular-nums">{f.phone ?? '—'}</div>
                      {f.executorName ? (
                        <div className="truncate text-xs" title={`Ijrochi: ${f.executorName}${f.executorPhone ? ` · ${f.executorPhone}` : ''}`}>
                          Ijrochi: {f.executorName}
                        </div>
                      ) : (
                        <div className="truncate text-xs">Ijrochi kiritilmagan</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{f._count.certificates}</td>
                    <td className="px-3 py-3">
                      <span className={`badge ${f.isActive ? 'border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-400' : 'border-slate-400/25 bg-slate-400/10 text-muted'}`}>
                        {f.isActive ? 'Faol' : 'Nofaol'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right"><FirmForm firm={f} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
