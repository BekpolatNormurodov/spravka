import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CertStatus, dmy, formatSum, ACTION_LABELS, canEdit, Role } from '@spravka/shared/core';
import { certQrDataUrl, certPublicUrl } from '@spravka/shared/qr';
import { StatusBadge, CertificateDocument, QrCard, firmForDocument, ReturnNotice, ContractCell, EventTimeline } from '@spravka/shared/ui';
import { Actions } from './Actions';
import { getSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CertDetail({ params }: { params: { id: string } }) {
  const session = await getSession();
  const c = await prisma.certificate.findUnique({
    where: { id: params.id },
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

  const publicUrl = certPublicUrl(c.id);
  const qr = await certQrDataUrl(c.id);
  // Rahbar sent it back → admin sees the reason.
  const returned = c.events[0]?.action === 'RETURN' ? c.events[0] : null;
  // Edit-lock (core rule): admin may edit only before approval.
  const editable = canEdit(session!.role as Role, c.status);

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/arizalar" className="text-muted hover:text-fg">← Orqaga</Link>
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
            contracts={c.contracts}
            contractType={c.contractType}
            loanAmount={c.loanAmount.toString()}
            asOfDate={c.asOfDate}
            asOfText={c.asOfText}
            infoRecipient={c.infoRecipient}
            firm={firmForDocument(c.firm, c.firmSnapshot)}
            qrDataUrl={qr}
          />
        </div>

        <div className="space-y-4">
          {(c.status === CertStatus.ADMIN_REVIEW || editable) && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold">Amal</h3>
              <div className="space-y-2">
                {c.status === CertStatus.ADMIN_REVIEW && <Actions id={c.id} />}
                {editable && (
                  <Link href={`/arizalar/${c.id}/tahrir`} className="btn-ghost w-full justify-center">
                    Hujjatni tahrirlash
                  </Link>
                )}
              </div>
            </div>
          )}

          <QrCard dataUrl={qr} url={publicUrl} signed={c.status === CertStatus.SIGNED} />

          <div className="card p-5 text-sm">
            <h3 className="mb-3 font-semibold">Maʼlumot</h3>
            <dl className="space-y-2 text-fg">
              <div className="flex justify-between gap-3"><dt className="text-muted">Firma</dt><dd className="text-right">{c.firm.shortName ?? c.firm.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Passport</dt><dd>{c.personPassport}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">{c.contracts.length > 1 ? `Shartnomalar (${c.contracts.length})` : 'Shartnoma'}</dt><dd className="text-right"><ContractCell contracts={c.contracts} /></dd></div>
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
