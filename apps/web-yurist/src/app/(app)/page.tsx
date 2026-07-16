import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { CertStatus, dmy, formatSum } from '@spravka/shared/core';
import { StatusBadge, PageHeader, EmptyState, ClickableRow, ViewAction } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const session = await getSession();
  const certs = await prisma.certificate.findMany({
    where: { createdById: session!.sub, deletedAt: null },
    include: {
      firm: { select: { shortName: true, name: true } },
      events: { where: { action: 'RETURN' }, orderBy: { createdAt: 'desc' }, take: 1, select: { note: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const returned = certs.filter((c) => c.status === CertStatus.DRAFT && c.events.length > 0).length;

  return (
    <div>
      <PageHeader
        title="Mening arizalarim"
        subtitle={returned > 0 ? `Jami: ${certs.length} ta · ${returned} ta qaytarilgan` : `Jami: ${certs.length} ta`}
        action={<Link href="/arizalar/yangi" className="btn-primary">+ Yangi ariza</Link>}
      />

      {certs.length === 0 ? (
        <EmptyState
          title="Hali ariza yoʻq"
          hint={<Link href="/arizalar/yangi" className="text-brand-600 hover:underline dark:text-brand-400">Birinchi arizani yarating</Link>}
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-surface-2 text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">№</th>
                  <th className="px-4 py-3 text-left font-medium">Jismoniy shaxs</th>
                  <th className="px-4 py-3 text-left font-medium">Passport</th>
                  <th className="px-4 py-3 text-left font-medium">Firma</th>
                  <th className="px-4 py-3 text-left font-medium">Shartnoma</th>
                  <th className="px-4 py-3 text-right font-medium">Summa (soʻm)</th>
                  <th className="px-4 py-3 text-left font-medium">Sana</th>
                  <th className="px-4 py-3 text-left font-medium">Holat</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => {
                  const back = c.status === CertStatus.DRAFT && c.events[0]?.note;
                  return (
                    <ClickableRow key={c.id} href={`/arizalar/${c.id}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-fg">{c.number}</td>
                      <td className="px-4 py-3 font-medium">
                        {c.personFullName}
                        {back && (
                          <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                            qaytarilgan
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{c.personPassport}</td>
                      <td className="px-4 py-3 text-fg">{c.firm.shortName ?? c.firm.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{c.contractNumber}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums">
                        {formatSum(c.loanAmount.toString())}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted">{dmy(c.issueDate)}</td>
                      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-3 text-right"><ViewAction href={`/arizalar/${c.id}`} /></td>
                    </ClickableRow>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
