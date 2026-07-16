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
      <p className="text-sm text-slate-400 mb-6">Jami: {certs.length}</p>

      {certs.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">Hali imzolangan maʼlumotnoma yoʻq.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400">
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
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{c.number}</td>
                  <td className="px-4 py-3">{c.personFullName}</td>
                  <td className="px-4 py-3 text-slate-300">{c.firm.shortName ?? c.firm.name}</td>
                  <td className="px-4 py-3 text-slate-400">{c.signedAt ? dmy(c.signedAt) : '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/arizalar/${c.id}`} className="text-brand-400 hover:underline">Ochish</Link>
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
