import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CertStatus } from '@spravka/shared/core';
import { StatusBadge } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('uz', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export default async function Arizalar() {
  const certs = await prisma.certificate.findMany({
    where: { deletedAt: null },
    include: { firm: { select: { shortName: true, name: true } }, createdBy: { select: { fullName: true } } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  const queue = certs.filter((c) => c.status === CertStatus.ADMIN_REVIEW);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Arizalar</h1>
        <p className="text-sm text-muted mt-1">
          Ko‘rikda: <span className="text-amber-600 dark:text-amber-300 font-medium">{queue.length}</span> · Jami: {certs.length}
        </p>
      </div>

      {certs.length === 0 ? (
        <div className="card p-10 text-center text-muted">Hali ariza yo‘q.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">№</th>
                <th className="text-left font-medium px-4 py-3">Jismoniy shaxs</th>
                <th className="text-left font-medium px-4 py-3">Firma</th>
                <th className="text-left font-medium px-4 py-3">Yurist</th>
                <th className="text-left font-medium px-4 py-3">Sana</th>
                <th className="text-left font-medium px-4 py-3">Holat</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-3 font-mono text-xs text-fg">{c.number}</td>
                  <td className="px-4 py-3">{c.personFullName}</td>
                  <td className="px-4 py-3 text-fg">{c.firm.shortName ?? c.firm.name}</td>
                  <td className="px-4 py-3 text-muted">{c.createdBy.fullName}</td>
                  <td className="px-4 py-3 text-muted">{fmtDate(c.issueDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/arizalar/${c.id}`} className="btn-ghost px-3 py-1.5 text-xs">Ochish</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
