import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// GET /api/download/[id] -> faylni majburiy yuklab beradi (Content-Disposition: attachment)
// Mobil brauzerlar (iOS Safari va h.k.) HTML `download` atributini e'tiborsiz qoldiradi,
// shuning uchun fayl shu route orqali attachment sarlavhasi bilan beriladi.
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = await prisma.qrCode.findUnique({ where: { id: params.id } });
  if (!item || !item.fileUrl) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }

  // fileUrl `/uploads/<name>` ko'rinishida saqlanadi. Path traversal'dan himoya uchun
  // faqat fayl nomini olamiz.
  const storedName = path.basename(item.fileUrl);
  const filePath = path.join(process.cwd(), "public", "uploads", storedName);

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Fayl mavjud emas" }, { status: 404 });
  }

  const buffer = await readFile(filePath);
  const downloadName = item.fileName || storedName;

  // RFC 5987 bo'yicha fayl nomini kodlash (Unicode/maxsus belgilar uchun)
  const asciiName = downloadName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_");
  const encodedName = encodeURIComponent(downloadName);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      "Cache-Control": "no-store",
    },
  });
}
