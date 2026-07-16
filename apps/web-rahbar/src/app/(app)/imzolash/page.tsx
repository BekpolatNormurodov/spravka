import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { CertStatus, dmy } from '@spravka/shared/core';

export const dynamic = 'force-dynamic';

export default async function Imzolash() {
  const certs = await prisma.certificate.findMany({
    where: { status: CertStatus.DIRECTOR_REVIEW, deletedAt: null },
    include: { firm: { select: { shortName: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Imzolash navbati</h1>
      <p className="text-sm text-muted mb-6">Admin tasdiqlagan, imzo kutayotgan maʼlumotnomalar: {certs.length}</p>

      {certs.length === 0 ? (
        <div className="card p-10 text-center text-muted">Imzolash uchun ariza yoʻq.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="text-left font-medium px-4 py-3">№</th>
                <th className="text-left font-medium px-4 py-3">Jismoniy shaxs</th>
                <th className="text-left font-medium px-4 py-3">Firma</th>
                <th className="text-left font-medium px-4 py-3">Sana</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-t border-line hover:bg-surface-2">
                  <td className="px-4 py-3 font-mono text-xs text-fg">{c.number}</td>
                  <td className="px-4 py-3">{c.personFullName}</td>
                  <td className="px-4 py-3 text-fg">{c.firm.shortName ?? c.firm.name}</td>
                  <td className="px-4 py-3 text-muted">{dmy(c.issueDate)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/arizalar/${c.id}`} className="btn-primary py-1.5 px-3 text-xs">Koʻrish va imzolash</Link>
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
