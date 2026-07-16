import QRCode from 'qrcode';
import { prisma } from '@spravka/shared/db';
import { CertStatus, certificateBody, dmy } from '@spravka/shared/core';
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
  const body = certificateBody({
    firmName: cert.firm.name.replace(/[“”"]/g, ''),
    personFullName: cert.personFullName,
    personPassport: cert.personPassport,
    passportIssuedBy: cert.passportIssuedBy,
    passportIssuedAt: cert.passportIssuedAt,
    contractNumber: cert.contractNumber,
    contractDate: cert.contractDate,
    contractType: cert.contractType,
    loanAmount: cert.loanAmount.toString(),
    asOfDate: cert.asOfDate,
  });

  return (
    <main className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="no-print mb-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-3 py-1.5 text-sm font-semibold">
            ✓ Rasmiy tasdiqlangan hujjat
          </div>
          <PrintButton />
        </div>

        <div className="sheet relative bg-white rounded-2xl shadow-xl p-8 md:p-12 leading-relaxed">
          <div className="flex justify-between items-start mb-8 gap-6">
            <div className="text-sm">
              <div>Сана: {dmy(cert.issueDate)} й</div>
              <div>№ {cert.number}</div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt="QR" className="h-24 w-24" />
          </div>

          <div className="text-right font-semibold mb-1">{cert.personFullName}га</div>
          <h2 className="text-center text-xl font-bold tracking-wide my-5">МАЪЛУМОТНОМА</h2>
          <p className="text-justify indent-8">{body}</p>

          <div className="relative mt-12 flex justify-between items-end">
            <div className="text-sm">
              <div className="font-semibold uppercase">{cert.firm.shortName ?? cert.firm.name}</div>
              <div className="mt-1">{cert.firm.directorPosition}</div>
            </div>
            <div className="text-sm font-semibold">{cert.firm.directorName}</div>
            <div className="pointer-events-none absolute right-0 -top-4 -rotate-12 rounded-lg border-4 border-emerald-600 px-3 py-1.5 text-emerald-700 font-extrabold tracking-widest opacity-80">
              ТАСДИҚЛАНДИ
            </div>
          </div>

          <div className="mt-6 text-xs text-slate-500">
            Ижрочи: {cert.firm.executorName}{cert.firm.executorPhone ? ` · Тел: ${cert.firm.executorPhone}` : ''}
          </div>
        </div>

        <p className="no-print text-center text-xs text-slate-400 mt-4">
          Hujjat haqiqiyligi QR kod orqali tasdiqlanadi · {cert.scans + 1} marta koʻrilgan
        </p>
      </div>
    </main>
  );
}
