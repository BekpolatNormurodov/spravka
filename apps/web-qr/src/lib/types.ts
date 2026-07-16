export type QrType = "URL" | "TEXT" | "HTML" | "FILE" | "IMAGE";

export interface QrCodeItem {
  id: string;
  name: string;
  type: QrType;
  content: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fgColor: string;
  bgColor: string;
  size: number;
  level: string;
  qrImageUrl: string | null;
  scans: number;
  createdAt: string;
  updatedAt: string;
}

export const TYPE_META: Record<
  QrType,
  { label: string; desc: string; color: string }
> = {
  URL: {
    label: "Havola (URL)",
    desc: "Skaner qilganda boshqa saytga yo'naltiradi",
    color: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  },
  TEXT: {
    label: "Matn",
    desc: "Oddiy matnni ko'rsatadi",
    color: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  },
  HTML: {
    label: "HTML / Forma",
    desc: "HTML kontent yoki formani ko'rsatadi",
    color: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  },
  FILE: {
    label: "Fayl",
    desc: "Faylni avtomatik yuklab beradi",
    color: "text-violet-300 bg-violet-500/10 border-violet-500/30",
  },
  IMAGE: {
    label: "Rasm",
    desc: "Rasmni ko'rsatadi",
    color: "text-rose-300 bg-rose-500/10 border-rose-500/30",
  },
};
