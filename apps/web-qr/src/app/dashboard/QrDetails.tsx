"use client";

import { useState } from "react";
import {
  CloseCircle,
  DocumentDownload,
  Copy,
  TickCircle,
  Link21,
  ExportSquare,
  Calendar,
  Eye,
  Hashtag,
} from "iconsax-react";
import type { QrCodeItem } from "@/lib/types";
import { TYPE_META } from "@/lib/types";

export default function QrDetails({
  item,
  appUrl,
  onClose,
}: {
  item: QrCodeItem | null;
  appUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const url = `${appUrl}/q/${item.id}`;
  const meta = TYPE_META[item.type];

  function copyLink() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full sm:max-w-3xl max-h-[94vh] overflow-y-auto card animate-fade-in rounded-t-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 className="text-lg font-bold truncate">{item.name}</h2>
            <span
              className={`inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${meta.color}`}
            >
              {meta.label}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white shrink-0">
            <CloseCircle size={26} />
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6 p-6">
          {/* QR rasm qismi */}
          <div className="flex flex-col items-center">
            <p className="text-xs text-slate-400 mb-4 uppercase tracking-wider">
              QR kod rasmi
            </p>
            <div
              className="rounded-2xl p-4 shadow-lg"
              style={{ background: item.bgColor }}
            >
              {item.qrImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.qrImageUrl}
                  alt={`${item.name} QR`}
                  width={240}
                  height={240}
                  className="rounded-lg"
                  style={{ width: 240, height: 240 }}
                />
              ) : (
                <div className="w-[240px] h-[240px] grid place-items-center text-slate-400 text-sm">
                  Rasm tayyorlanmoqda...
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 w-full mt-5">
              {item.qrImageUrl && (
                <a
                  href={item.qrImageUrl}
                  download={`${item.name || item.id}-qr.png`}
                  className="btn-primary w-full"
                >
                  <DocumentDownload size={18} color="#fff" />
                  QR rasmni yuklab olish (PNG)
                </a>
              )}
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="btn-ghost w-full"
              >
                <ExportSquare size={18} />
                Skaner sahifasini ochish
              </a>
            </div>
          </div>

          {/* Ma'lumot (data) qismi — alohida */}
          <div className="space-y-4">
            <p className="text-xs text-slate-400 uppercase tracking-wider">
              Ma'lumotlar
            </p>

            {/* O'zgarmas havola */}
            <div>
              <p className="label flex items-center gap-1.5">
                <Link21 size={14} /> O'zgarmas havola
              </p>
              <div className="rounded-xl bg-black/30 px-3 py-2.5 flex items-center gap-2">
                <code className="text-xs text-brand-300 truncate flex-1">{url}</code>
                <button
                  onClick={copyLink}
                  className="text-slate-400 hover:text-white shrink-0"
                  title="Nusxa olish"
                >
                  {copied ? (
                    <TickCircle size={16} className="text-emerald-400" />
                  ) : (
                    <Copy size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Meta ma'lumotlar */}
            <div className="grid grid-cols-2 gap-3">
              <InfoBox
                icon={<Hashtag size={14} />}
                label="Unique ID"
                value={item.id}
              />
              <InfoBox
                icon={<Eye size={14} />}
                label="Skanerlar"
                value={String(item.scans)}
              />
              <InfoBox
                icon={<Calendar size={14} />}
                label="Yaratilgan"
                value={new Date(item.createdAt).toLocaleString("uz")}
              />
              <InfoBox
                icon={<Calendar size={14} />}
                label="Yangilangan"
                value={new Date(item.updatedAt).toLocaleString("uz")}
              />
            </div>

            {/* Kontent / data */}
            <div>
              <p className="label">Kontent</p>
              {item.type === "URL" && (
                <a
                  href={item.content || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-xl bg-black/30 px-3 py-2.5 text-sm text-sky-300 break-all hover:underline"
                >
                  {item.content}
                </a>
              )}

              {item.type === "TEXT" && (
                <div className="rounded-xl bg-black/30 px-3 py-2.5 text-sm text-slate-200 whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {item.content}
                </div>
              )}

              {item.type === "HTML" && (
                <pre className="rounded-xl bg-black/30 px-3 py-2.5 text-xs text-amber-200 overflow-x-auto max-h-48">
                  <code>{item.content}</code>
                </pre>
              )}

              {(item.type === "FILE" || item.type === "IMAGE") && item.fileUrl && (
                <div className="space-y-3">
                  {item.type === "IMAGE" && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.fileUrl}
                      alt={item.fileName || item.name}
                      className="w-full max-h-48 object-contain rounded-xl bg-black/30"
                    />
                  )}
                  <a
                    href={item.fileUrl}
                    download={item.fileName || true}
                    className="btn-ghost w-full"
                  >
                    <DocumentDownload size={16} />
                    {item.fileName || "Faylni yuklab olish"}
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-xs text-slate-200 mt-1 truncate" title={value}>
        {value}
      </p>
    </div>
  );
}
