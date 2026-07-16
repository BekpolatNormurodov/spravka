import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { CertStatus, dmy, formatSum, ACTION_LABELS } from '@spravka/shared/core';
import { certQrDataUrl, certPublicUrl } from '@spravka/shared/qr';
import { StatusBadge, CertificateDocument, QrCard, firmForDocument, ReturnNotice } from '@spravka/shared/ui';

export const dynamic = 'force-dynamic';

export default async function CertDetail({ params }: { params: { id: string } }) {
  const session = await getSession();
  const c = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: {
      firm: true,
      createdBy: { select: { fullName: true } },
      events: { include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  // A yurist only sees their own arizas.
  if (!c || c.deletedAt || c.createdById !== session!.sub) notFound();

  const publicUrl = certPublicUrl(c.id);
  const qr = await certQrDataUrl(c.id);
  // Most recent event is a RETURN → the reviewer sent it back with a reason.
  const returned = c.events[0]?.action === 'RETURN' ? c.events[0] : null;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/" className="text-muted hover:text-fg">← Orqaga</Link>
        <span className="font-mono text-sm text-muted">{c.number}</span>
        <StatusBadge status={c.status} />
      </div>

      {returned?.note && (
        <div className="mb-6">
          <ReturnNotice note={returned.note} by={returned.actor.fullName} at={dmy(returned.createdAt)} />
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
            contractNumber={c.contractNumber}
            contractDate={c.contractDate}
            contractType={c.contractType}
            loanAmount={c.loanAmount.toString()}
            asOfDate={c.asOfDate}
            firm={firmForDocument(c.firm, c.firmSnapshot)}
            signed={c.status === CertStatus.SIGNED}
            qrDataUrl={qr}
          />
        </div>

        <div className="space-y-4">
          <QrCard dataUrl={qr} url={publicUrl} signed={c.status === CertStatus.SIGNED} />

          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-semibold">Maʼlumot</h3>
            <dl className="space-y-2 text-fg">
              <div className="flex justify-between gap-3"><dt className="text-muted">Firma</dt><dd className="text-right">{c.firm.shortName ?? c.firm.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Passport</dt><dd>{c.personPassport}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Shartnoma</dt><dd>{c.contractNumber}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Summa</dt><dd>{formatSum(c.loanAmount.toString())} soʻm</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Sana</dt><dd>{dmy(c.issueDate)}</dd></div>
            </dl>
          </div>

          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-semibold">Tarix</h3>
            {c.events.length === 0 ? (
              <p className="text-muted">Hali harakat yoʻq.</p>
            ) : (
              <ul className="space-y-2">
                {c.events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 text-muted">
                    <span>{ACTION_LABELS[e.action]} · {e.actor.fullName}</span>
                    <span>{dmy(e.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
