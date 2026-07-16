import { prisma } from '@/lib/prisma';
import { FirmForm } from './FirmForm';

export const dynamic = 'force-dynamic';

export default async function Firmalar() {
  const firms = await prisma.firm.findMany({ orderBy: { createdAt: 'asc' } });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Firmalar</h1>
      <p className="text-sm text-muted mb-6">Mikromoliya tashkilotlari va ularning rekvizitlari</p>

      <FirmForm />

      <div className="card overflow-hidden mt-6">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-muted">
            <tr>
              <th className="text-left font-medium px-4 py-3">Nomi</th>
              <th className="text-left font-medium px-4 py-3">Direktor</th>
              <th className="text-left font-medium px-4 py-3">STIR</th>
              <th className="text-left font-medium px-4 py-3">Telefon</th>
            </tr>
          </thead>
          <tbody>
            {firms.map((f) => (
              <tr key={f.id} className="border-t border-line">
                <td className="px-4 py-3">{f.shortName ?? f.name}</td>
                <td className="px-4 py-3 text-fg">{f.directorName}</td>
                <td className="px-4 py-3 text-muted">{f.stir ?? '—'}</td>
                <td className="px-4 py-3 text-muted">{f.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
