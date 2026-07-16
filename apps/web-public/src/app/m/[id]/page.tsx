import QRCode from 'qrcode';
import { prisma } from '@spravka/shared/db';
import { CertStatus } from '@spravka/shared/core';
import { CertificateDocument } from '@spravka/shared/ui';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

export default async function PublicCert({ params }: { params: { id: string } }) {
  const c = await prisma.certificate.findUnique({ where: { id: params.id }, include: { firm: true } });
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
          <h1 className="text-lg font-bold">Maʼlumotnoma tasdiqlanmagan</h1>
          <p className="text-sm text-slate-500 mt-2">
            Ushbu havola boʻyicha rasmiy imzolangan hujjat topilmadi yoki u bekor qilingan.
          </p>
        </div>
      </main>
    );
  }

  const cert = c!;
  const publicUrl = `${process.env.NEXT_PUBLIC_PUBLIC_URL ?? 'http://localhost:5100'}/m/${cert.id}`;
  const qr = await QRCode.toDataURL(publicUrl, { width: 220, margin: 1 });

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="mx-auto" style={{ maxWidth: '210mm' }}>
        <div className="no-print mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1.5 text-sm font-semibold">
            ✓ Rasmiy tasdiqlangan hujjat
          </div>
          <PrintButton />
        </div>

        <div className="cert-frame rounded-2xl shadow-xl">
          <CertificateDocument
            number={cert.number}
            issueDate={cert.issueDate}
            personFullName={cert.personFullName}
            personPassport={cert.personPassport}
            passportIssuedBy={cert.passportIssuedBy}
            passportIssuedAt={cert.passportIssuedAt}
            contractNumber={cert.contractNumber}
            contractDate={cert.contractDate}
            contractType={cert.contractType}
            loanAmount={cert.loanAmount.toString()}
            asOfDate={cert.asOfDate}
            firm={cert.firm}
            signed
            qrDataUrl={qr}
          />
        </div>

        <p className="no-print text-center text-xs text-slate-400 mt-4">
          Hujjat haqiqiyligi QR kod orqali tasdiqlanadi · {cert.scans + 1} marta koʻrilgan
        </p>
      </div>
    </main>
  );
}
