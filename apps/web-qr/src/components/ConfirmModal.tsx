"use client";

import { CloseCircle, Warning2, LogoutCurve, Trash } from "iconsax-react";

export type ConfirmVariant = "danger" | "warning";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText = "Tasdiqlash",
  cancelText = "Bekor qilish",
  variant = "danger",
  icon = "trash",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: "trash" | "logout" | "warning";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const accent =
    variant === "danger"
      ? "bg-rose-500/15 text-rose-400"
      : "bg-amber-500/15 text-amber-400";

  const confirmBtn =
    variant === "danger" ? "btn-danger" : "btn-primary";

  const IconEl =
    icon === "logout" ? LogoutCurve : icon === "warning" ? Warning2 : Trash;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-sm card p-6 animate-fade-in">
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-slate-400 hover:text-white"
        >
          <CloseCircle size={22} />
        </button>

        <div className={`grid place-items-center h-14 w-14 rounded-2xl mx-auto mb-4 ${accent}`}>
          <IconEl size={28} variant="Bold" />
        </div>

        <h3 className="text-lg font-bold text-center">{title}</h3>
        <p className="text-sm text-slate-400 text-center mt-2">{message}</p>

        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="btn-ghost flex-1" disabled={loading}>
            {cancelText}
          </button>
          <button onClick={onConfirm} className={`${confirmBtn} flex-1`} disabled={loading}>
            {loading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
