import QRCode from "qrcode";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

export interface QrStyle {
  fgColor?: string;
  bgColor?: string;
  size?: number;
  level?: string;
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5000";
}

/**
 * QR kodni serverda PNG rasm sifatida generatsiya qilib,
 * public/qr/[id].png ga saqlaydi va public URL qaytaradi.
 */
export async function generateQrImage(
  id: string,
  style: QrStyle = {}
): Promise<string> {
  const url = `${appUrl()}/q/${id}`;
  const size = Math.min(Math.max(Number(style.size) || 512, 256), 1024);

  const buffer = await QRCode.toBuffer(url, {
    type: "png",
    errorCorrectionLevel: (style.level as "L" | "M" | "Q" | "H") || "M",
    width: size,
    margin: 2,
    color: {
      dark: style.fgColor || "#0f172a",
      light: style.bgColor || "#ffffff",
    },
  });

  const dir = path.join(process.cwd(), "public", "qr");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${id}.png`), buffer);

  return `/qr/${id}.png`;
}

/** QR rasm faylini o'chiradi (QR o'chirilganda). */
export async function deleteQrImage(id: string): Promise<void> {
  try {
    await unlink(path.join(process.cwd(), "public", "qr", `${id}.png`));
  } catch {
    // fayl yo'q bo'lsa e'tiborsiz
  }
}
