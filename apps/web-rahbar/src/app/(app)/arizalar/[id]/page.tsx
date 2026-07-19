import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CertStatus, dmy, formatSum, ACTION_LABELS } from '@spravka/shared/core';
import { certQrDataUrl, certPublicUrl } from '@spravka/shared/qr';
import { StatusBadge, CertificateDocument, QrCard, firmForDocument, EventTimeline } from '@spravka/shared/ui';
import { Actions } from './Actions';
import { requireRahbarFirmId } from '@/lib/scope';

export const dynamic = 'force-dynamic';

export default async function CertDetail({ params }: { params: { id: string } }) {
  // findFirst, not findUnique: the firm scope belongs in the lookup rather than a check after it,
  // and firmId is not part of a unique key. Another firm's ariza simply does not exist here — the
  // document carries a person's passport, so "found but forbidden" would still say too much.
  const c = await prisma.certificate.findFirst({
    where: { id: params.id, firmId: await requireRahbarFirmId() },
    include: {
      firm: true,
      contracts: { orderBy: { order: 'asc' } },
      createdBy: { select: { fullName: true } },
      events: {
        include: { actor: { select: { fullName: true } }, attachments: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!c || c.deletedAt) notFound();

  const signed = c.status === CertStatus.SIGNED;
  const publicUrl = certPublicUrl(c.id);
  const qr = await certQrDataUrl(c.id);

  // What the admin wrote when they passed it up. The rahbar signs on the strength of this, so
  // it sits above the document rather than at the bottom of the history.
  const handover = c.events.find((e) => e.action === 'APPROVE' && (e.note || e.attachments.length > 0));

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/imzolash" className="text-muted hover:text-fg">← Orqaga</Link>
        <span className="font-mono text-sm text-muted">{c.number}</span>
        <StatusBadge status={c.status} />
      </div>

      {handover && (
        <div className="mb-6 rounded-2xl border border-brand-500/30 bg-brand-500/10 p-4">
          <p className="mb-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
            Admindan xabar
          </p>
          <EventTimeline events={[handover]} hrefFor={(id) => `/api/attachments/${id}`} />
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[auto_320px]">
        <div className="cert-frame rounded-2xl shadow-xl">
          <CertificateDocument
            number={c.number}
            issueDate={c.issueDate}
            personFullName={c.personFullName}
            personPassport={c.personPassport}
            passportIssuedBy={c.passportIssuedBy}
            passportIssuedAt={c.passportIssuedAt}
            contracts={c.contracts}
            contractType={c.contractType}
            loanAmount={c.loanAmount.toString()}
            asOfDate={c.asOfDate}
            asOfText={c.asOfText}
            firm={firmForDocument(c.firm, c.firmSnapshot)}
            signed={signed}
            qrDataUrl={qr}
          />
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold">Amal</h3>
            <Actions id={c.id} status={c.status} number={c.number} personFullName={c.personFullName} />
          </div>

          <QrCard dataUrl={qr} url={publicUrl} signed={signed} />

          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-semibold">Maʼlumot</h3>
            <dl className="space-y-2 text-fg">
              <div className="flex justify-between gap-3"><dt className="text-muted">Firma</dt><dd className="text-right">{c.firm.shortName ?? c.firm.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Passport</dt><dd>{c.personPassport}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Summa</dt><dd>{formatSum(c.loanAmount.toString())} soʻm</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Yurist</dt><dd>{c.createdBy.fullName}</dd></div>
            </dl>
          </div>

          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-semibold">Tarix</h3>
            <EventTimeline events={c.events} hrefFor={(id) => `/api/attachments/${id}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
