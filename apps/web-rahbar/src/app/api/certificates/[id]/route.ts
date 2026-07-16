import { NextResponse } from 'next/server';
import { Prisma } from '@spravka/shared/db';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { WfAction, findTransition, canDelete, canActOnFirm } from '@spravka/shared/core';
import { buildCertificatePdf, savePdf, removePdf, CERT_PDF_INCLUDE } from '@spravka/shared/pdf';
import { rahbarFirmId } from '@/lib/scope';

const MAP: Record<string, WfAction> = {
  sign: WfAction.SIGN,
  return: WfAction.RETURN,
};

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, note } = await req.json().catch(() => ({}));

  // The whole row, not a slice of it: signing renders the document, which needs every printed
  // field — including the contracts, which the maʼlumotnoma lists inline.
  const cert = await prisma.certificate.findUnique({
    where: { id: params.id },
    include: CERT_PDF_INCLUDE,
  });
  if (!cert || cert.deletedAt) return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });

  // A rahbar acts only on their own firm — every action below (sign, return, delete) is theirs
  // alone to take. 404, not 403: whether another firm's ariza exists is not their business.
  if (!canActOnFirm(session.role, await rahbarFirmId(), cert.firmId)) {
    return NextResponse.json({ error: 'Topilmadi' }, { status: 404 });
  }

  // Soft-delete (RAHBAR-only) — not a status transition.
  if (action === 'delete') {
    if (!canDelete(session.role)) return NextResponse.json({ error: 'Ruxsat yoʻq' }, { status: 403 });
    if (!note?.trim()) return NextResponse.json({ error: 'Sabab majburiy' }, { status: 400 });
    await prisma.$transaction([
      prisma.certificate.update({
        where: { id: params.id },
        data: { deletedAt: new Date(), deletedById: session.sub, deletedReason: note.trim() },
      }),
      prisma.workflowEvent.create({
        data: {
          certificateId: params.id,
          actorId: session.sub,
          action: WfAction.DELETE,
          fromStatus: cert.status,
          toStatus: cert.status,
          note: note.trim(),
        },
      }),
    ]);
    return NextResponse.json({ ok: true, deleted: true });
  }

  const wf = MAP[action];
  if (!wf) return NextResponse.json({ error: 'Notoʻgʻri amal' }, { status: 400 });

  // Returning must explain why — admin/yurist act on this text.
  if (wf === WfAction.RETURN && !note?.trim()) {
    return NextResponse.json({ error: 'Qaytarish sababi majburiy' }, { status: 400 });
  }

  const t = findTransition(cert.status, session.role, wf);
  if (!t) return NextResponse.json({ error: 'Bu holatda amalni bajarib boʻlmaydi' }, { status: 400 });

  const data: Prisma.CertificateUpdateInput = { status: t.to };
  let writtenPdf: string | null = null;

  if (wf === WfAction.SIGN) {
    data.signedBy = { connect: { id: session.sub } };
    data.signedAt = new Date();
    // Freeze the firm's rekvizitlar at the moment of signing. Editing the Firm afterwards
    // must not rewrite this already-issued document.
    const f = cert.firm;
    const firmSnapshot = {
      name: f.name, letterheadName: f.letterheadName, shortName: f.shortName, stir: f.stir, oked: f.oked,
      directorName: f.directorName, directorFullName: f.directorFullName,
      directorPosition: f.directorPosition, accountantName: f.accountantName,
      executorName: f.executorName, executorPhone: f.executorPhone,
      phone: f.phone, email: f.email, website: f.website,
      region: f.region, address: f.address,
      bankName: f.bankName, bankAccount: f.bankAccount, mfo: f.mfo,
      logoPath: f.logoPath, sealPath: f.sealPath, signaturePath: f.signaturePath,
    };
    data.firmSnapshot = firmSnapshot;

    // Freeze the document itself, from that same snapshot, so the file and the snapshot cannot
    // disagree. Rendering runs before — and outside — the transaction: it takes about a second
    // and must not sit on row locks. Nothing is committed yet, so a failure here leaves the
    // ariza exactly as it was.
    try {
      const pdf = await buildCertificatePdf({ ...cert, firmSnapshot });
      const saved = await savePdf(cert.id, pdf);
      writtenPdf = saved.pdfPath;
      data.pdfPath = saved.pdfPath;
      data.pdfSha256 = saved.pdfSha256;
    } catch (err) {
      console.error('[sign] PDF render failed', err);
      return NextResponse.json({ error: 'Hujjatni PDF qilishda xatolik — imzolanmadi' }, { status: 500 });
    }
  }

  try {
    await prisma.$transaction([
      prisma.certificate.update({ where: { id: params.id }, data }),
      prisma.workflowEvent.create({
        data: {
          certificateId: params.id,
          actorId: session.sub,
          action: wf,
          fromStatus: t.from,
          toStatus: t.to,
          note: note?.trim() || null,
        },
      }),
    ]);
  } catch (err) {
    // A file with no row is orphaned bytes; a row pointing at nothing is a broken document.
    // Undo the write so a retry starts clean.
    if (writtenPdf) await removePdf(writtenPdf).catch(() => {});
    throw err;
  }

  return NextResponse.json({ ok: true, status: t.to });
}
