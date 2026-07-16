import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateQrId } from "@/lib/id";
import { generateQrImage } from "@/lib/qrImage";

export const runtime = "nodejs";

// GET /api/qr  -> barcha QR kodlar ro'yxati
export async function GET() {
  const items = await prisma.qrCode.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(items);
}

// POST /api/qr -> yangi QR yaratish (o'zgarmas unique id beriladi)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const {
    name,
    type = "URL",
    content = null,
    fileUrl = null,
    fileName = null,
    fgColor,
    bgColor,
    size,
    level,
  } = body;

  if (!name || String(name).trim().length === 0) {
    return NextResponse.json({ error: "Nom kiritilishi shart" }, { status: 400 });
  }

  // To'qnashuvga qarshi: takrorlanmas id yaratish
  let id = generateQrId();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.qrCode.findUnique({ where: { id } });
    if (!exists) break;
    id = generateQrId();
  }

  const created = await prisma.qrCode.create({
    data: {
      id,
      name: String(name).trim(),
      type,
      content,
      fileUrl,
      fileName,
      ...(fgColor ? { fgColor } : {}),
      ...(bgColor ? { bgColor } : {}),
      ...(size ? { size: Number(size) } : {}),
      ...(level ? { level } : {}),
    },
  });

  // Tayyor QR rasmni serverda generatsiya qilib, public/qr ga saqlash
  const qrImageUrl = await generateQrImage(id, {
    fgColor: created.fgColor,
    bgColor: created.bgColor,
    size: created.size,
    level: created.level,
  });

  const withImage = await prisma.qrCode.update({
    where: { id },
    data: { qrImageUrl },
  });

  return NextResponse.json(withImage, { status: 201 });
}
