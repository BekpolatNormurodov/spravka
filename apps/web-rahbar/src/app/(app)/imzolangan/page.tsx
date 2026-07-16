import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CertStatus, dmy } from '@spravka/shared/core';

export const dynamic = 'force-dynamic';

export default async function Imzolangan() {
  const certs = await prisma.certificate.findMany({
    where: { status: CertStatus.SIGNED, deletedAt: null },
    include: { firm: { select: { shortName: true, name: true } } },
    orderBy: { signedAt: 'desc' },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Imzolangan maʼlumotnomalar</h1>
      <p className="text-sm text-muted mb-6">Jami: {certs.length}</p>

      {certs.length === 0 ? (
        <div className="card p-10 text-center text-muted">Hali imzolangan maʼlumotnoma yoʻq.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">№</th>
                <th className="text-left font-medium px-4 py-3">Jismoniy shaxs</th>
                <th className="text-left font-medium px-4 py-3">Firma</th>
                <th className="text-left font-medium px-4 py-3">Imzolangan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-3 font-mono text-xs text-fg">{c.number}</td>
                  <td className="px-4 py-3">{c.personFullName}</td>
                  <td className="px-4 py-3 text-fg">{c.firm.shortName ?? c.firm.name}</td>
                  <td className="px-4 py-3 text-muted">{c.signedAt ? dmy(c.signedAt) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/arizalar/${c.id}`} className="text-brand-600 dark:text-brand-400 hover:underline">Ochish</Link>
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
