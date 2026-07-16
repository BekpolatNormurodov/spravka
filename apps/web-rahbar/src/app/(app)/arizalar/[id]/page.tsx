import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { CertStatus, certificateBody, dmy, formatSum, ACTION_LABELS } from '@spravka/shared/core';
import { StatusBadge } from '@spravka/shared/ui';
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

  const signed = c.status === CertStatus.SIGNED;
  const publicUrl = `${process.env.NEXT_PUBLIC_PUBLIC_URL ?? 'http://localhost:5000'}/m/${c.id}`;

  const body = certificateBody({
    firmName: c.firm.name.replace(/[“”"]/g, ''),
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
        <Link href="/imzolash" className="text-muted hover:text-fg">← Orqaga</Link>
        <span className="font-mono text-sm text-fg">{c.number}</span>
        <StatusBadge status={c.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="relative rounded-2xl bg-white text-slate-900 p-8 md:p-10 shadow-xl leading-relaxed overflow-hidden">
          {signed && (
            <div className="pointer-events-none absolute right-6 bottom-24 -rotate-12 rounded-lg border-4 border-emerald-600 px-4 py-2 text-emerald-700 font-extrabold tracking-widest opacity-80">
              ТАСДИҚЛАНДИ
            </div>
          )}
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
          <div className="mt-6 text-xs text-neutral-500">
            Ижрочи: {c.firm.executorName}{c.firm.executorPhone ? ` · Тел: ${c.firm.executorPhone}` : ''}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-sm font-semibold mb-3">Amal</h3>
            <Actions id={c.id} status={c.status} />
          </div>

          {signed && (
            <div className="card p-5 text-sm">
              <h3 className="font-semibold mb-2 text-accent-600 dark:text-accent-400">Public havola</h3>
              <a href={publicUrl} target="_blank" className="text-brand-600 dark:text-brand-400 break-all hover:underline">{publicUrl}</a>
            </div>
          )}

          <div className="card p-5 text-sm">
            <h3 className="font-semibold mb-3">Maʼlumot</h3>
            <dl className="space-y-2 text-fg">
              <div className="flex justify-between gap-3"><dt className="text-muted">Firma</dt><dd className="text-right">{c.firm.shortName ?? c.firm.name}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Passport</dt><dd>{c.personPassport}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Summa</dt><dd>{formatSum(c.loanAmount.toString())} soʻm</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted">Yurist</dt><dd>{c.createdBy.fullName}</dd></div>
            </dl>
          </div>

          <div className="card p-5 text-sm">
            <h3 className="font-semibold mb-3">Tarix</h3>
            <ul className="space-y-2">
              {c.events.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 text-muted">
                  <span>{ACTION_LABELS[e.action]} · {e.actor.fullName}</span>
                  <span className="text-muted">{dmy(e.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
