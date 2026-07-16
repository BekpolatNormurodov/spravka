import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { generateQrId } from "@/lib/id";

export const runtime = "nodejs";

// POST /api/upload -> fayl yoki rasm yuklash
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Fayl yo'q" }, { status: 400 });
  }

  const MAX = 25 * 1024 * 1024; // 25MB
  if (file.size > MAX) {
    return NextResponse.json(
      { error: "Fayl hajmi 25MB dan oshmasligi kerak" },
      { status: 413 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${generateQrId()}-${safeName}`;

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, storedName), buffer);

  return NextResponse.json({
    fileUrl: `/uploads/${storedName}`,
    fileName: file.name,
    mimeType: file.type,
  });
}
