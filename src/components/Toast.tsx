"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

type ToastType = "info" | "error" | "success";

type ToastItem = {
  id: number;
  m: string;
  t: ToastType;
};

let pushFn: ((m: string, t?: ToastType) => void) | null = null;
export function toast(m: string, t: ToastType = "info") {
  pushFn?.(m, t);
}

const TONE: Record<ToastType, string> = {
  error: "bg-red-600 text-white",
  success: "bg-emerald-600 text-white",
  info: "bg-slate-800 text-white",
};

const TOAST_MAX = 4;

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    pushFn = (m, t = "info") => {
      const id = Date.now() + Math.random();
      setItems((s) => {
        const next = [...s, { id, m, t }];
        return next.length > TOAST_MAX ? next.slice(next.length - TOAST_MAX) : next;
      });
      window.setTimeout(() => {
        setItems((s) => s.filter((i) => i.id !== id));
      }, 4000);
    };
    return () => {
      pushFn = null;
    };
  }, []);

  function dismiss(id: number) {
    setItems((s) => s.filter((i) => i.id !== id));
  }

  return (
    <div
      className="pointer-events-none fixed left-3 right-3 top-16 z-[100] flex flex-col gap-2 sm:left-auto sm:top-4 sm:right-4 sm:max-w-sm"
      role="status"
      aria-live="polite"
    >
      {items.map((i) => (
        <div
          key={i.id}
          className={`pointer-events-auto flex items-start gap-2 rounded-md px-3 py-2 text-sm shadow-lg transition-all ${TONE[i.t]}`}
        >
          <span className="min-w-0 flex-1 break-words">{i.m}</span>
          <button
            type="button"
            className="shrink-0 opacity-70 hover:opacity-100"
            onClick={() => dismiss(i.id)}
            aria-label="Tutup notifikasi"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}