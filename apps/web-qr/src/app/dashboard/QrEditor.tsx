"use client";

import { useEffect, useState } from "react";
import {
  CloseCircle,
  Link21,
  DocumentText,
  Code,
  DocumentUpload,
  Gallery,
  TickCircle,
  DocumentUpload as UploadIcon,
} from "iconsax-react";
import type { QrCodeItem, QrType } from "@/lib/types";
import { TYPE_META } from "@/lib/types";
import QrPreview from "@/components/QrPreview";

const TYPE_ICONS: Record<QrType, React.ReactNode> = {
  URL: <Link21 size={18} />,
  TEXT: <DocumentText size={18} />,
  HTML: <Code size={18} />,
  FILE: <DocumentUpload size={18} />,
  IMAGE: <Gallery size={18} />,
};

const emptyDraft: Partial<QrCodeItem> = {
  name: "",
  type: "URL",
  content: "",
  fileUrl: null,
  fileName: null,
  fgColor: "#0f172a",
  bgColor: "#ffffff",
  size: 256,
  level: "M",
};

export default function QrEditor({
  open,
  mode,
  initial,
  appUrl,
  onClose,
  onSaved,
}: {
  open: boolean;
  mode: "create" | "edit";
  initial: QrCodeItem | null;
  appUrl: string;
  onClose: () => void;
  onSaved: (item: QrCodeItem) => void;
}) {
  const [draft, setDraft] = useState<Partial<QrCodeItem>>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setError("");
      setDraft(mode === "edit" && initial ? { ...initial } : { ...emptyDraft });
    }
  }, [open, mode, initial]);

  if (!open) return null;

  const type = (draft.type || "URL") as QrType;
  const set = (patch: Partial<QrCodeItem>) =>
    setDraft((d) => ({ ...d, ...patch }));

  async function handleUpload(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Yuklashda xatolik");
        return;
      }
      set({ fileUrl: data.fileUrl, fileName: data.fileName });
    } catch {
      setError("Faylni yuklab bo'lmadi");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError("");
    if (!draft.name?.trim()) {
      setError("Nom kiritilishi shart");
      return;
    }
    if ((type === "URL" || type === "TEXT" || type === "HTML") && !draft.content?.trim()) {
      setError("Kontent kiritilishi shart");
      return;
    }
    if ((type === "FILE" || type === "IMAGE") && !draft.fileUrl) {
      setError("Fayl yuklang");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: draft.name,
        type: draft.type,
        content:
          type === "FILE" || type === "IMAGE" ? null : draft.content,
        fileUrl: draft.fileUrl ?? null,
        fileName: draft.fileName ?? null,
        fgColor: draft.fgColor,
        bgColor: draft.bgColor,
        size: draft.size,
        level: draft.level,
      };

      const res = await fetch(
        mode === "create" ? "/api/qr" : `/api/qr/${initial!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Saqlashda xatolik");
        return;
      }
      onSaved(data);
    } catch {
      setError("Serverga ulanib bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  const previewItem = {
    ...emptyDraft,
    ...draft,
    id: initial?.id || "PREVIEW",
    qrImageUrl: null, // jonli canvas ko'rinishi (rang o'zgarishini ko'rsatish uchun)
  } as QrCodeItem;
  const previewUrl =
    mode === "edit" && initial ? `${appUrl}/q/${initial.id}` : `${appUrl}/q/preview`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-4xl max-h-[94vh] overflow-y-auto card animate-fade-in rounded-t-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
          <h2 className="text-lg font-bold">
            {mode === "create" ? "Yangi QR yaratish" : "QR ni tahrirlash"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <CloseCircle size={26} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* Left: form */}
          <div className="space-y-5">
            <div>
              <label className="label">Nom</label>
              <input
                className="input"
                placeholder="Masalan: Restoran menyusi"
                value={draft.name || ""}
                onChange={(e) => set({ name: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Tur</label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {(Object.keys(TYPE_META) as QrType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => set({ type: t })}
                    className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-[11px] font-medium transition ${
                      type === t
                        ? "border-brand-500 bg-brand-500/15 text-white"
                        : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {TYPE_ICONS[t]}
                    {TYPE_META[t].label.split(" ")[0]}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">{TYPE_META[type].desc}</p>
            </div>

            {/* Type-specific content */}
            {type === "URL" && (
              <div>
                <label className="label">Yo'naltiriladigan havola</label>
                <input
                  className="input"
                  placeholder="https://example.com"
                  value={draft.content || ""}
                  onChange={(e) => set({ content: e.target.value })}
                />
              </div>
            )}

            {type === "TEXT" && (
              <div>
                <label className="label">Matn</label>
                <textarea
                  className="input min-h-[120px] resize-y"
                  placeholder="Ko'rsatiladigan matn..."
                  value={draft.content || ""}
                  onChange={(e) => set({ content: e.target.value })}
                />
              </div>
            )}

            {type === "HTML" && (
              <div>
                <label className="label">HTML kod / forma</label>
                <textarea
                  className="input min-h-[160px] resize-y font-mono text-xs"
                  placeholder="<h1>Salom</h1> <form>...</form>"
                  value={draft.content || ""}
                  onChange={(e) => set({ content: e.target.value })}
                />
              </div>
            )}

            {(type === "FILE" || type === "IMAGE") && (
              <div>
                <label className="label">
                  {type === "IMAGE" ? "Rasm yuklash" : "Fayl yuklash"}
                </label>
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-8 cursor-pointer hover:border-brand-500/50 transition">
                  <UploadIcon size={28} className="text-brand-400" />
                  <span className="text-sm text-slate-300">
                    {uploading
                      ? "Yuklanmoqda..."
                      : draft.fileName || "Fayl tanlang yoki sudrab tashlang"}
                  </span>
                  <span className="text-xs text-slate-500">Maksimum 25MB</span>
                  <input
                    type="file"
                    className="hidden"
                    accept={type === "IMAGE" ? "image/*" : undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                    }}
                  />
                </label>
                {draft.fileUrl && (
                  <p className="mt-2 text-xs text-emerald-400 flex items-center gap-1">
                    <TickCircle size={14} /> Yuklandi: {draft.fileName}
                  </p>
                )}
              </div>
            )}

            {/* Style */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">QR rangi</label>
                <input
                  type="color"
                  className="h-10 w-full rounded-xl bg-transparent cursor-pointer"
                  value={draft.fgColor || "#0f172a"}
                  onChange={(e) => set({ fgColor: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Fon rangi</label>
                <input
                  type="color"
                  className="h-10 w-full rounded-xl bg-transparent cursor-pointer"
                  value={draft.bgColor || "#ffffff"}
                  onChange={(e) => set({ bgColor: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Xatoga chidamlilik</label>
                <select
                  className="input"
                  value={draft.level || "M"}
                  onChange={(e) => set({ level: e.target.value })}
                >
                  <option value="L">L — past</option>
                  <option value="M">M — o'rtacha</option>
                  <option value="Q">Q — yuqori</option>
                  <option value="H">H — eng yuqori</option>
                </select>
              </div>
              <div>
                <label className="label">O'lcham: {draft.size}px</label>
                <input
                  type="range"
                  min={128}
                  max={512}
                  step={8}
                  className="w-full accent-brand-500 mt-3"
                  value={draft.size || 256}
                  onChange={(e) => set({ size: Number(e.target.value) })}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 px-4 py-2.5 text-sm text-rose-300">
                {error}
              </div>
            )}
          </div>

          {/* Right: live preview */}
          <div className="flex flex-col">
            <div className="card p-6 flex flex-col items-center sticky top-24">
              <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider">
                Jonli ko'rinish
              </p>
              <QrPreview
                item={previewItem}
                url={previewUrl}
                size={200}
                showDownload={mode === "edit"}
              />
              {mode === "edit" && initial && (
                <div className="mt-4 w-full">
                  <p className="text-xs text-slate-500">O'zgarmas havola:</p>
                  <code className="block mt-1 text-xs text-brand-300 break-all bg-black/30 rounded-lg px-3 py-2">
                    {previewUrl}
                  </code>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-slate-950/80 backdrop-blur-xl">
          <button onClick={onClose} className="btn-ghost">
            Bekor qilish
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            <TickCircle size={18} color="#fff" />
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}
