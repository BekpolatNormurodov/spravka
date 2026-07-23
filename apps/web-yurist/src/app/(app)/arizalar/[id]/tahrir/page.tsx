import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canEdit, Role, uzLongDate, uzLongDateLatin } from '@spravka/shared/core';
import { firmForDocument } from '@spravka/shared/ui';
import { getSession } from '@/lib/session';
import { EditArizaSheet } from './EditArizaSheet';
import { EditCourtArizaSheet } from './EditCourtArizaSheet';

export const dynamic = 'force-dynamic';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

/**
 * A yurist coming back to their own draft — the same sheet they wrote it on.
 *
 * Once the ariza is submitted it stops being theirs to change (core's canEdit gives a yurist DRAFT
 * and nothing more), so this redirects rather than 403s: they came to look at their document, and
 * the read-only page is the honest answer.
 */
export default async function EditArizaPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const c = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: { firm: true, contracts: { orderBy: { order: 'asc' } } },
  });
  if (!c || c.deletedAt || c.createdById !== session!.sub) notFound();

  if (!canEdit(session!.role as Role, c.status)) redirect(`/arizalar/${c.id}`);

  const firm = firmForDocument(c.firm, c.firmSnapshot);

  if (c.docType === 'ARIZA') {
    return (
      <EditCourtArizaSheet
        id={c.id}
        number={c.number}
        firm={firm}
        initial={{
          courtName: c.courtName ?? '',
          personFullName: c.personFullName,
          personPinfl: c.personPinfl ?? '',
          personAddress: c.personAddress ?? '',
          personPhone: c.personPhone ?? '',
          contracts: c.contracts.map((k) => ({ number: k.number, date: iso(k.date) })),
          contractType: c.contractType,
          interestRate: c.interestRate ?? '',
          loanAmount: c.loanAmount.toString(),
          asOfDate: iso(c.asOfDate),
          asOfText: c.asOfText ?? uzLongDateLatin(c.asOfDate),
          debtPrincipal: c.debtPrincipal?.toString() ?? '',
          debtTermInterest: c.debtTermInterest?.toString() ?? '',
          debtOverduePrincipal: c.debtOverduePrincipal?.toString() ?? '',
          debtOverdueInterest: c.debtOverdueInterest?.toString() ?? '',
          debtTotal: c.debtTotal?.toString() ?? '',
          chamberSignerPosition: c.chamberSignerPosition ?? '',
          chamberSignerName: c.chamberSignerName ?? '',
          chamberExecutorName: c.chamberExecutorName ?? '',
          chamberExecutorPhone: c.chamberExecutorPhone ?? '',
          issueDate: iso(c.issueDate),
        }}
      />
    );
  }

  return (
    <EditArizaSheet
      id={c.id}
      number={c.number}
      firm={firm}
      initial={{
        personPinfl: c.personPinfl ?? '',
        personFullName: c.personFullName,
        // Always set for a maʼlumotnoma; the column is nullable only for arizas.
        personPassport: c.personPassport ?? '',
        passportIssuedBy: c.passportIssuedBy ?? '',
        passportIssuedAt: iso(c.passportIssuedAt),
        contracts: c.contracts.map((k) => ({ number: k.number, date: iso(k.date) })),
        contractType: c.contractType,
        loanAmount: c.loanAmount.toString(),
        asOfDate: iso(c.asOfDate),
        // Arizas written before the phrase existed read from the date they were made with.
        asOfText: c.asOfText ?? uzLongDate(c.asOfDate),
        issueDate: iso(c.issueDate),
        infoRecipient: c.infoRecipient,
      }}
    />
  );
}
