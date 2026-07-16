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
            <table className="w-full min-w-[1140px] text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Tashkilot</th>
                  <th className="px-4 py-3 text-left font-medium">Ijrochi direktor</th>
                  <th className="px-4 py-3 text-left font-medium">Ijrochi</th>
                  <th className="px-4 py-3 text-left font-medium">STIR</th>
                  <th className="px-4 py-3 text-left font-medium">Bank / MFO</th>
                  <th className="px-4 py-3 text-left font-medium">Telefon</th>
                  <th className="px-4 py-3 text-right font-medium">Arizalar</th>
                  <th className="px-4 py-3 text-left font-medium">Holat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {firms.map((f) => (
                  <tr key={f.id} className="border-t border-line transition-colors hover:bg-surface-2">
                    <td className="px-4 py-3">
                      <div className="font-medium">{f.shortName ?? f.name}</div>
                      <div className="mt-0.5 max-w-[320px] truncate text-xs text-muted" title={f.name}>{f.name}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-medium">{f.directorName}</span>
                      <div className="text-xs text-muted">{f.directorPosition}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">
                      {f.executorName}
                      {f.executorPhone && <div className="text-xs">{f.executorPhone}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-muted">{f.stir ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {f.bankName ? (
                        <>
                          <div className="text-fg">{f.bankName}</div>
                          <div className="font-mono tabular-nums">
                            {f.bankAccount ? maskAccount(f.bankAccount) : '—'}{f.mfo ? ` · MFO ${f.mfo}` : ''}
                          </div>
                        </>
                      ) : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{f.phone}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">{f._count.certificates}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${f.isActive ? 'border-accent-500/30 bg-accent-500/10 text-accent-700 dark:text-accent-400' : 'border-slate-400/25 bg-slate-400/10 text-muted'}`}>
                        {f.isActive ? 'Faol' : 'Nofaol'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right"><FirmForm firm={f} /></td>
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
