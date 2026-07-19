import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { canEdit, Role } from '@spravka/shared/core';
import { firmForDocument } from '@spravka/shared/ui';
import { getSession } from '@/lib/session';
import { EditArizaSheet } from './EditArizaSheet';

export const dynamic = 'force-dynamic';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');

/**
 * The admin's content edit, on the document rather than in a modal beside it.
 *
 * Same sheet the yurist writes on, so a correction is made where it will be read. The edit-lock is
 * re-checked here and again in the API — this page only decides whether to show the editor.
 */
export default async function EditArizaPage({ params }: { params: { id: string } }) {
  const session = await getSession();
  const c = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: { firm: true, contracts: { orderBy: { order: 'asc' } } },
  });
  if (!c || c.deletedAt) notFound();

  // Approved or signed: the document is frozen and the detail page is the only view left.
  if (!canEdit(session!.role as Role, c.status)) redirect(`/arizalar/${c.id}`);

  return (
    <EditArizaSheet
      id={c.id}
      number={c.number}
      firm={firmForDocument(c.firm, c.firmSnapshot)}
      initial={{
        personPinfl: c.personPinfl ?? '',
        personFullName: c.personFullName,
        personPassport: c.personPassport,
        passportIssuedBy: c.passportIssuedBy ?? '',
        passportIssuedAt: iso(c.passportIssuedAt),
        contracts: c.contracts.map((k) => ({ number: k.number, date: iso(k.date) })),
        contractType: c.contractType,
        loanAmount: c.loanAmount.toString(),
        asOfDate: iso(c.asOfDate),
        issueDate: iso(c.issueDate),
      }}
    />
  );
}
