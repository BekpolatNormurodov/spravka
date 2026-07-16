import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CertStatus, certificateBody, dmy, formatSum, ACTION_LABELS } from '@spravka/shared/core';
import { StatusBadge } from '@/components/StatusBadge';
import { Actions } from './Actions';

export const dynamic = 'force-dynamic';

export default async function CertDetail({ params }: { params: { id: string } }) {
  const c = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: {
      firm: true,
      createdBy: { select: { fullName: true } },
      events: { include: { actor: { select: { fullName: true } } }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!c || c.deletedAt) notFound();

  const body = certificateBody({
    firmName: c.firm.name.replace(/^“|”.*$/g, '').replace(/”/g, ''),
    personFullName: c.personFullName,
    personPassport: c.personPassport,
    passportIssuedBy: c.passportIssuedBy,
    passportIssuedAt: c.passportIssuedAt,
    contractNumber: c.contractNumber,
    contractDate: c.contractDate,
    contractType: c.contractType,
    loanAmount: c.loanAmount.toString(),
    asOfDate: c.asOfDate,
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/arizalar" className="text-slate-400 hover:text-white">← Orqaga</Link>
        <span className="font-mono text-sm text-slate-300">{c.number}</span>
        <StatusBadge status={c.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Document preview (A4-like) */}
        <div className="rounded-2xl bg-white text-slate-900 p-8 md:p-10 shadow-xl leading-relaxed">
          <div className="flex justify-between text-sm mb-6">
            <div>Сана: {dmy(c.issueDate)} й</div>
            <div>№ {c.number}</div>
          </div>
          <div className="text-right font-semibold mb-1">{c.personFullName}га</div>
          <h2 className="text-center text-lg font-bold tracking-wide my-5">МАЪЛУМОТНОМА</h2>
          <p className="text-justify indent-8">{body}</p>
          <div className="mt-10 flex justify-between items-end">
            <div className="text-sm">
              <div className="font-semibold uppercase">{c.firm.shortName ?? c.firm.name}</div>
              <div className="mt-1">{c.firm.directorPosition}</div>
            </div>
            <div className="text-sm font-semibold">{c.firm.directorName}</div>
          </div>
          <div className="mt-6 text-xs text-slate-500">
            Ижрочи: {c.firm.executorName}{c.firm.executorPhone ? ` · Тел: ${c.firm.executorPhone}` : ''}
          </div>
        </div>

        {/* Side panel: facts + actions + timeline */}
        <div className="space-y-4">
          {c.status === CertStatus.ADMIN_REVIEW && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold mb-3">Amal</h3>
              <Actions id={c.id} />
            </div>
          )}

          <div className="card p-5 text-sm">
            <h3 className="font-semibold mb-3">Maʼlumot</h3>
            <dl className="space-y-2 text-slate-300">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Firma</dt><dd className="text-right">{c.firm.shortName ?? c.firm.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Passport</dt><dd>{c.personPassport}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Shartnoma</dt><dd>{c.contractNumber}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Summa</dt><dd>{formatSum(c.loanAmount.toString())} soʻm</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Yurist</dt><dd>{c.createdBy.fullName}</dd></div>
            </dl>
          </div>

          <div className="card p-5 text-sm">
            <h3 className="font-semibold mb-3">Tarix</h3>
            {c.events.length === 0 ? (
              <p className="text-slate-500">Hali harakat yoʻq.</p>
            ) : (
              <ul className="space-y-2">
                {c.events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-3 text-slate-400">
                    <span>{ACTION_LABELS[e.action]} · {e.actor.fullName}</span>
                    <span className="text-slate-500">{dmy(e.createdAt)}</span>
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
