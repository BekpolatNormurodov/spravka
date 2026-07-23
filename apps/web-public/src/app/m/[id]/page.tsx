import { prisma } from '@spravka/shared/db';
import { CertStatus } from '@spravka/shared/core';
import { certQrDataUrl } from '@spravka/shared/qr';
import { DocumentView } from '@spravka/shared/ui';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function PublicCert({ params }: { params: { id: string } }) {
  const c = await prisma.certificate.findUnique({ where: { id: params.id }, include: { firm: true, contracts: { orderBy: { order: 'asc' } } } });
  const exists = c && !c.deletedAt;
  if (exists) {
    await prisma.certificate.update({ where: { id: c!.id }, data: { scans: { increment: 1 } } }).catch(() => {});
  }
  const valid = exists && c!.status === CertStatus.SIGNED;

  if (!valid) {
    return (
      <main className="min-h-screen grid place-items-center p-4">
        <div className="max-w-md w-full text-center bg-white rounded-2xl shadow-xl p-10">
          <div className="inline-block -rotate-6 border-4 border-red-600 text-red-600 font-extrabold tracking-widest px-4 py-1.5 rounded mb-5">
            ТАСДИҚЛАНМАГАН
          </div>
          <h1 className="text-lg font-bold">Hujjat tasdiqlanmagan</h1>
          <p className="text-sm text-slate-500 mt-2">
            Ushbu havola boʻyicha rasmiy imzolangan hujjat topilmadi yoki u bekor qilingan.
          </p>
        </div>
      </main>
    );
  }

  const cert = c!;
  const qr = await certQrDataUrl(cert.id);

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="mx-auto" style={{ maxWidth: '210mm' }}>
        <div className="no-print mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1.5 text-sm font-semibold">
            ✓ Rasmiy tasdiqlangan hujjat
          </div>
          <div className="flex items-center gap-2">
            {/* The page below is a re-render; this is the file that was actually issued. */}
            <a
              href={`/m/${cert.id}/pdf`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Rasmiy PDF
            </a>
            <PrintButton />
          </div>
        </div>

        <div className="cert-frame rounded-2xl shadow-xl">
          <DocumentView cert={cert} qrDataUrl={qr} />
        </div>

        <p className="no-print text-center text-xs text-slate-400 mt-4">
          Hujjat haqiqiyligi QR kod orqali tasdiqlanadi · {cert.scans + 1} marta koʻrilgan
        </p>
      </div>
    </main>
  );
}
