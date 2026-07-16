import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { StatusBadge } from '@/components/StatusBadge';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date) {
  return new Intl.DateTimeFormat('uz', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

export default async function Dashboard() {
  const session = await getSession();
  const certs = await prisma.certificate.findMany({
    where: { createdById: session!.sub, deletedAt: null },
    include: { firm: { select: { shortName: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Mening arizalarim</h1>
          <p className="text-sm text-slate-400 mt-1">Jami: {certs.length} ta</p>
        </div>
        <Link href="/arizalar/yangi" className="btn-primary">+ Yangi ariza</Link>
      </div>

      {certs.length === 0 ? (
        <div className="card p-10 text-center text-slate-400">
          Hali ariza yoʻq. <Link href="/arizalar/yangi" className="text-brand-400 hover:underline">Birinchi arizani yarating</Link>.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-slate-400">
              <tr>
                <th className="text-left font-medium px-4 py-3">№</th>
                <th className="text-left font-medium px-4 py-3">Jismoniy shaxs</th>
                <th className="text-left font-medium px-4 py-3">Firma</th>
                <th className="text-left font-medium px-4 py-3">Sana</th>
                <th className="text-left font-medium px-4 py-3">Holat</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{c.number}</td>
                  <td className="px-4 py-3">{c.personFullName}</td>
                  <td className="px-4 py-3 text-slate-300">{c.firm.shortName ?? c.firm.name}</td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(c.issueDate)}</td>
                  <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
