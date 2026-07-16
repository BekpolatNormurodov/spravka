import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQrImage, deleteQrImage } from "@/lib/qrImage";

export const runtime = "nodejs";

// GET /api/qr/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = await prisma.qrCode.findUnique({ where: { id: params.id } });
  if (!item) return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  return NextResponse.json(item);
}

// PATCH /api/qr/[id] -> type va parametrlarni o'zgartirish (id o'zgarmaydi)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));

  const allowed = [
    "name",
    "type",
    "content",
    "fileUrl",
    "fileName",
    "fgColor",
    "bgColor",
    "size",
    "level",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) {
      data[key] = key === "size" ? Number(body[key]) : body[key];
    }
  }

  try {
    const updated = await prisma.qrCode.update({
      where: { id: params.id },
      data,
    });

    // Agar ko'rinish parametrlari o'zgargan bo'lsa, QR rasmni qayta generatsiya qilish
    const styleChanged =
      "fgColor" in data ||
      "bgColor" in data ||
      "size" in data ||
      "level" in data;

    if (styleChanged || !updated.qrImageUrl) {
      const qrImageUrl = await generateQrImage(updated.id, {
        fgColor: updated.fgColor,
        bgColor: updated.bgColor,
        size: updated.size,
        level: updated.level,
      });
      const refreshed = await prisma.qrCode.update({
        where: { id: updated.id },
        data: { qrImageUrl },
      });
      return NextResponse.json(refreshed);
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
}

// DELETE /api/qr/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.qrCode.delete({ where: { id: params.id } });
    await deleteQrImage(params.id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
}
