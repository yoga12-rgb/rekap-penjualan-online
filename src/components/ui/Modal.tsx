"use client";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  closeOnBackdrop = false,
  size = "md"
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  size?: "md" | "lg" | "xl";
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const maxW = size === "xl" ? "sm:max-w-3xl" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 sm:p-4"
      onClick={() => { if (closeOnBackdrop) onClose(); }}
    >
      <div
        className={`card w-full ${maxW} p-4 sm:p-5 max-h-[95vh] overflow-y-auto rounded-b-none sm:rounded-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between sticky top-0 -mx-4 sm:-mx-5 px-4 sm:px-5 -mt-4 sm:-mt-5 pt-4 sm:pt-5 pb-3 z-10"
             style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}>
          <h3 className="text-base font-semibold pr-3">{title}</h3>
          <button className="btn-ghost shrink-0" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
