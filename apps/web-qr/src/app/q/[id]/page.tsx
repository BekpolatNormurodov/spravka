import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DocumentDownload, DocumentText, Code } from "iconsax-react";
import AutoDownload from "./AutoDownload";

export const dynamic = "force-dynamic";

function normalizeUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}

export default async function PublicQrPage({
  params,
}: {
  params: { id: string };
}) {
  const item = await prisma.qrCode.findUnique({ where: { id: params.id } });
  if (!item) notFound();

  // Skaner sonini oshirish
  await prisma.qrCode
    .update({ where: { id: params.id }, data: { scans: { increment: 1 } } })
    .catch(() => {});

  // URL turida tashqi saytga yo'naltirish
  if (item.type === "URL" && item.content) {
    redirect(normalizeUrl(item.content));
  }

  // FILE turida avtomatik yuklab berish
  if (item.type === "FILE" && item.fileUrl) {
    // Majburiy yuklash uchun API route (mobil brauzerlarda ham ishlaydi)
    const downloadUrl = `/api/download/${item.id}`;
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <AutoDownload fileUrl={downloadUrl} fileName={item.fileName || "file"} />
        <div className="card p-8 max-w-md w-full text-center animate-fade-in">
          <div className="grid place-items-center h-16 w-16 rounded-2xl bg-brand-600/20 mx-auto mb-4">
            <DocumentDownload size={34} className="text-brand-400" />
          </div>
          <h1 className="text-xl font-bold">{item.name}</h1>
          <p className="text-sm text-slate-400 mt-2">
            Yuklab olish avtomatik boshlandi...
          </p>
          <p className="text-xs text-slate-500 mt-1">{item.fileName}</p>
          <a
            href={downloadUrl}
            download={item.fileName || true}
            className="btn-primary w-full mt-6"
          >
            <DocumentDownload size={18} color="#fff" />
            Qo'lda yuklab olish
          </a>
        </div>
      </main>
    );
  }

  // IMAGE turida rasmni ko'rsatish
  if (item.type === "IMAGE" && item.fileUrl) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-4 gap-5">
        <div className="card p-4 max-w-2xl w-full animate-fade-in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.fileUrl}
            alt={item.name}
            className="w-full h-auto rounded-xl"
          />
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">{item.name}</h1>
          <a href={`/api/download/${item.id}`} download={item.fileName || true} className="btn-ghost py-2">
            <DocumentDownload size={16} />
            Yuklab olish
          </a>
        </div>
      </main>
    );
  }

  // TEXT turida matnni ko'rsatish
  if (item.type === "TEXT") {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="card p-8 max-w-2xl w-full animate-fade-in">
          <div className="flex items-center gap-3 mb-5">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-emerald-500/15">
              <DocumentText size={22} className="text-emerald-400" />
            </div>
            <h1 className="text-xl font-bold">{item.name}</h1>
          </div>
          <div className="whitespace-pre-wrap text-slate-200 leading-relaxed">
            {item.content}
          </div>
        </div>
      </main>
    );
  }

  // HTML turida HTML kontentni render qilish
  if (item.type === "HTML") {
    return (
      <main className="min-h-screen p-4 sm:p-8">
        <div className="card p-6 sm:p-10 max-w-3xl mx-auto animate-fade-in">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/10">
            <div className="grid place-items-center h-11 w-11 rounded-xl bg-amber-500/15">
              <Code size={22} className="text-amber-400" />
            </div>
            <h1 className="text-xl font-bold">{item.name}</h1>
          </div>
          <div
            className="qr-html-content prose prose-invert max-w-none"
            // Kontent faqat tizimga kirgan admin tomonidan yaratiladi
            dangerouslySetInnerHTML={{ __html: item.content || "" }}
          />
        </div>
      </main>
    );
  }

  // Hech qaysi turga to'g'ri kelmasa
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-8 max-w-md text-center">
        <h1 className="text-xl font-bold">{item.name}</h1>
        <p className="text-sm text-slate-400 mt-2">Kontent mavjud emas</p>
      </div>
    </main>
  );
}
