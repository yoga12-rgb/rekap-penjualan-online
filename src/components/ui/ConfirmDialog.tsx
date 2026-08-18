"use client";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Hapus",
  cancelText = "Batal",
  busy = false,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title={title} size="md">
      <div className="space-y-4">
        <div
          className={`rounded-md border p-3 ${
            danger
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
              : "border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200"
          }`}
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              size={18}
              className={`mt-0.5 shrink-0 ${danger ? "text-red-600" : "text-slate-500"}`}
            />
            <div className="text-sm space-y-1">{message}</div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn-outline"
            onClick={onClose}
            disabled={busy}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={danger ? "btn-primary bg-red-700 hover:bg-red-800" : "btn-primary"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Memproses..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
}