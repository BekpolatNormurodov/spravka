import { NextResponse } from 'next/server';
import { Prisma } from '@spravka/shared/db';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/session';
import { WfAction, findTransition, canDelete, canActOnFirm } from '@spravka/shared/core';
import {
  buildCertificatePdf, savePdf, removePdf, readPdf, sha256, certPdfPath, CERT_PDF_INCLUDE,
  type CertificateWithFirm,
} from '@spravka/shared/pdf';
import { rahbarFirmId } from '@/lib/scope';

/** A signing attempt is one human typing one password. Anything older is abandoned. */
const CHALLENGE_TTL_MS = 10 * 60_000;

const MAP: Record<string, WfAction> = {
  return: WfAction.RETURN,
};

/**
 * The firm's rekvizitlar as the document will print them, frozen at this instant. Built once and
 * carried through the challenge, so the PDF, the snapshot and the signature all describe the
 * same firm even if someone edits it mid-signing.
 */
function buildFirmSnapshot(f: CertificateWithFirm['firm']) {
  return {
    name: f.name, letterheadName: f.letterheadName, shortName: f.shortName, stir: f.stir, oked: f.oked,
    directorName: f.directorName, directorFullName: f.directorFullName,
    directorPosition: f.directorPosition, accountantName: f.accountantName,
    executorName: f.executorName, executorPhone: f.executorPhone,
    phone: f.phone, email: f.email, website: f.website,
    region: f.region, address: f.address,
    bankName: f.bankName, bankAccount: f.bankAccount, mfo: f.mfo,
    logoPath: f.logoPath, sealPath: f.sealPath, signaturePath: f.signaturePath,
  };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { action, note, challengeId, pkcs7, signerInfo } = await req.json().catch(() => ({}));

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

  /*
    Signing is two calls, because the rahbar signs *bytes* and the server has to know exactly
    which bytes it handed out. Rendering first and committing only once the signature comes back
    also resolves the apparent circularity — the PDF carries the ТАСДИҚЛАНДИ stamp, which needs
    a signed status, which needs the PDF.
  */
  if (action === 'sign-prepare' || action === 'sign-commit') {
    const t = findTransition(cert.status, session.role, WfAction.SIGN);
    if (!t) return NextResponse.json({ error: 'Bu holatda imzolab boʻlmaydi' }, { status: 400 });

    if (action === 'sign-prepare') {
      const firmSnapshot = buildFirmSnapshot(cert.firm);
      let pdf: Buffer;
      try {
        pdf = await buildCertificatePdf({ ...cert, firmSnapshot });
        await savePdf(cert.id, pdf);
      } catch (err) {
        console.error('[sign-prepare] PDF render failed', err);
        return NextResponse.json({ error: 'Hujjatni PDF qilishda xatolik' }, { status: 500 });
      }

      // One live attempt per certificate — a stale challenge must not be completable later.
      await prisma.signChallenge.deleteMany({ where: { certificateId: cert.id } });
      const challenge = await prisma.signChallenge.create({
        data: {
          certificateId: cert.id,
          userId: session.sub,
          pdfSha256: sha256(pdf),
          firmSnapshot,
          expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
        },
      });

      return NextResponse.json({
        challengeId: challenge.id,
        pdfBase64: pdf.toString('base64'),
      });
    }

    // ── sign-commit ────────────────────────────────────────────────────────
    if (typeof pkcs7 !== 'string' || pkcs7.length < 100) {
      return NextResponse.json({ error: 'Imzo kelmadi' }, { status: 400 });
    }

    const challenge = await prisma.signChallenge.findUnique({ where: { id: String(challengeId ?? '') } });
    if (!challenge || challenge.certificateId !== cert.id || challenge.userId !== session.sub) {
      return NextResponse.json({ error: 'Imzolash seansi topilmadi — qaytadan boshlang' }, { status: 400 });
    }
    if (challenge.expiresAt < new Date()) {
      await prisma.signChallenge.delete({ where: { id: challenge.id } }).catch(() => {});
      return NextResponse.json({ error: 'Imzolash seansi eskirdi — qaytadan boshlang' }, { status: 400 });
    }

    // The file on disk must still be the one we handed out. A second prepare would have replaced
    // it, and committing then would file a signature against bytes nobody signed.
    const pdfPath = certPdfPath(cert.id);
    const onDisk = await readPdf(pdfPath);
    if (!onDisk || sha256(onDisk) !== challenge.pdfSha256) {
      return NextResponse.json({ error: 'Hujjat oʻzgargan — qaytadan imzolang' }, { status: 409 });
    }

    await prisma.$transaction([
      prisma.certificate.update({
        where: { id: cert.id },
        data: {
          status: t.to,
          signedBy: { connect: { id: session.sub } },
          signedAt: new Date(),
          firmSnapshot: challenge.firmSnapshot ?? Prisma.JsonNull,
          pdfPath,
          pdfSha256: challenge.pdfSha256,
        },
      }),
      prisma.certSignature.create({
        data: {
          certificateId: cert.id,
          pkcs7,
          pdfSha256: challenge.pdfSha256,
          // Not verified, and not pretending to be: checking an O'zDSt 1092:2009 signature needs
          // E-IMZO-SERVER, which needs a NIC contract. Stored as evidence a third party can check.
          verified: false,
          signerInfo: signerInfo ?? Prisma.JsonNull,
        },
      }),
      prisma.workflowEvent.create({
        data: {
          certificateId: cert.id,
          actorId: session.sub,
          action: WfAction.SIGN,
          fromStatus: t.from,
          toStatus: t.to,
          note: null,
        },
      }),
      prisma.signChallenge.delete({ where: { id: challenge.id } }),
    ]);

    return NextResponse.json({ ok: true, status: t.to });
  }

  const wf = MAP[action];
  if (!wf) return NextResponse.json({ error: 'Notoʻgʻri amal' }, { status: 400 });

  // Returning must explain why — admin/yurist act on this text.
  if (wf === WfAction.RETURN && !note?.trim()) {
    return NextResponse.json({ error: 'Qaytarish sababi majburiy' }, { status: 400 });
  }

  const t = findTransition(cert.status, session.role, wf);
  if (!t) return NextResponse.json({ error: 'Bu holatda amalni bajarib boʻlmaydi' }, { status: 400 });

  // Only RETURN reaches here now — signing goes through sign-prepare/sign-commit above.
  await prisma.$transaction([
    prisma.certificate.update({ where: { id: params.id }, data: { status: t.to } }),
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

  return NextResponse.json({ ok: true, status: t.to });
}
