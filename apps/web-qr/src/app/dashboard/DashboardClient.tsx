"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ScanBarcode,
  Add,
  SearchNormal1,
  LogoutCurve,
  Edit2,
  Trash,
  Copy,
  TickCircle,
  Eye,
  Chart2,
  Box,
} from "iconsax-react";
import type { QrCodeItem } from "@/lib/types";
import { TYPE_META } from "@/lib/types";
import QrPreview from "@/components/QrPreview";
import QrEditor from "./QrEditor";
import QrDetails from "./QrDetails";
import ConfirmModal from "@/components/ConfirmModal";

export default function DashboardClient({
  initialItems,
  username,
  appUrl,
}: {
  initialItems: QrCodeItem[];
  username: string;
  appUrl: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<QrCodeItem[]>(initialItems);
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<QrCodeItem | null>(null);

  const [details, setDetails] = useState<QrCodeItem | null>(null);

  // O'chirish va chiqish tasdiqlash modallari
  const [toDelete, setToDelete] = useState<QrCodeItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        i.type.toLowerCase().includes(q)
    );
  }, [items, query]);

  const totalScans = useMemo(
    () => items.reduce((s, i) => s + (i.scans || 0), 0),
    [items]
  );

  function openCreate() {
    setEditorMode("create");
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(item: QrCodeItem) {
    setEditorMode("edit");
    setEditing(item);
    setEditorOpen(true);
  }

  function onSaved(saved: QrCodeItem) {
    setItems((prev) => {
      const exists = prev.some((i) => i.id === saved.id);
      return exists
        ? prev.map((i) => (i.id === saved.id ? saved : i))
        : [saved, ...prev];
    });
    setEditorOpen(false);
  }

  async function remove(item: QrCodeItem) {
    setDeleting(true);
    const res = await fetch(`/api/qr/${item.id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((i) => i.id !== item.id));
    setDeleting(false);
    setToDelete(null);
  }

  function copyLink(item: QrCodeItem) {
    const url = `${appUrl}/q/${item.id}`;
    navigator.clipboard.writeText(url);
    setCopied(item.id);
    setTimeout(() => setCopied(null), 1500);
  }

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid place-items-center h-10 w-10 rounded-xl bg-brand-600 shadow-glow">
              <ScanBarcode size={22} color="#fff" variant="Bold" />
            </div>
            <div>
              <p className="font-bold leading-tight">QRCode Pro</p>
              <p className="text-xs text-slate-500 leading-tight">
                Dinamik QR boshqaruvi
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-sm text-slate-400">
              Salom, <span className="text-slate-200 font-medium">{username}</span>
            </span>
            <button onClick={() => setLogoutOpen(true)} className="btn-ghost py-2">
              <LogoutCurve size={18} />
              <span className="hidden sm:inline">Chiqish</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            icon={<Box size={22} className="text-brand-400" />}
            label="Jami QR kodlar"
            value={items.length}
          />
          <StatCard
            icon={<Chart2 size={22} className="text-emerald-400" />}
            label="Jami skanerlar"
            value={totalScans}
          />
          <StatCard
            icon={<ScanBarcode size={22} className="text-sky-400" />}
            label="Faol havolalar"
            value={items.length}
            className="col-span-2 lg:col-span-1"
          />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative w-full sm:max-w-md">
            <SearchNormal1
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              className="input pl-11"
              placeholder="Nom, ID yoki tur bo'yicha qidirish..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button onClick={openCreate} className="btn-primary">
            <Add size={20} color="#fff" />
            Yangi QR yaratish
          </button>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="card p-16 flex flex-col items-center text-center">
            <div className="grid place-items-center h-16 w-16 rounded-2xl bg-white/5 mb-4">
              <ScanBarcode size={32} className="text-slate-500" />
            </div>
            <p className="text-lg font-semibold">QR kodlar topilmadi</p>
            <p className="text-sm text-slate-500 mt-1">
              Birinchi QR kodingizni yaratish uchun tugmani bosing
            </p>
            <button onClick={openCreate} className="btn-primary mt-5">
              <Add size={20} color="#fff" />
              Yangi QR yaratish
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((item) => {
              const url = `${appUrl}/q/${item.id}`;
              const meta = TYPE_META[item.type];
              return (
                <div
                  key={item.id}
                  className="card p-5 flex flex-col gap-4 hover:border-white/20 transition animate-fade-in"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{item.name}</h3>
                      <span
                        className={`inline-block mt-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                      <Eye size={14} /> {item.scans}
                    </span>
                  </div>

                  <div className="flex justify-center py-2">
                    <QrPreview item={item} url={url} size={150} showDownload={false} />
                  </div>

                  <div className="rounded-lg bg-black/30 px-3 py-2 flex items-center gap-2">
                    <code className="text-[11px] text-brand-300 truncate flex-1">
                      /q/{item.id}
                    </code>
                    <button
                      onClick={() => copyLink(item)}
                      className="text-slate-400 hover:text-white shrink-0"
                      title="Havoladan nusxa olish"
                    >
                      {copied === item.id ? (
                        <TickCircle size={16} className="text-emerald-400" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setDetails(item)}
                      className="btn-ghost flex-1 py-2 text-xs"
                    >
                      <Eye size={15} />
                      Ko'rish
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="btn-ghost flex-1 py-2 text-xs"
                    >
                      <Edit2 size={15} />
                      Tahrirlash
                    </button>
                    <button
                      onClick={() => setToDelete(item)}
                      className="btn-danger py-2 px-3"
                      title="O'chirish"
                    >
                      <Trash size={15} color="#fff" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <QrEditor
        open={editorOpen}
        mode={editorMode}
        initial={editing}
        appUrl={appUrl}
        onClose={() => setEditorOpen(false)}
        onSaved={onSaved}
      />

      <QrDetails
        item={details}
        appUrl={appUrl}
        onClose={() => setDetails(null)}
      />

      <ConfirmModal
        open={!!toDelete}
        variant="danger"
        icon="trash"
        title="QR kodni o'chirish"
        message={
          toDelete
            ? `"${toDelete.name}" butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.`
            : ""
        }
        confirmText="O'chirish"
        loading={deleting}
        onConfirm={() => toDelete && remove(toDelete)}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmModal
        open={logoutOpen}
        variant="warning"
        icon="logout"
        title="Tizimdan chiqish"
        message="Hisobingizdan chiqmoqchimisiz?"
        confirmText="Chiqish"
        loading={loggingOut}
        onConfirm={logout}
        onCancel={() => setLogoutOpen(false)}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`card p-5 flex items-center gap-4 ${className}`}>
      <div className="grid place-items-center h-12 w-12 rounded-xl bg-white/5">
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
