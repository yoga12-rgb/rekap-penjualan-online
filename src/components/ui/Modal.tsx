"use client";
import { useEffect, useRef, type CSSProperties } from "react";

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
  const contentRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
        [
          "input:not([type='hidden']):not(:disabled)",
          "select:not(:disabled)",
          "textarea:not(:disabled)",
          "button:not(:disabled)",
          "[href]",
          "[tabindex]:not([tabindex='-1'])"
        ].join(",")
      );
      firstFocusable?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const maxWidth = size === "xl" ? "56rem" : size === "lg" ? "42rem" : "32rem";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 sm:p-4"
      onClick={() => { if (closeOnBackdrop) onClose(); }}
    >
      <div
        ref={contentRef}
        className="card w-screen max-w-[100vw] p-4 sm:w-full sm:max-w-[var(--modal-max-width)] sm:p-5 max-h-[92vh] overflow-y-auto overflow-x-hidden rounded-b-none sm:rounded-lg shadow-2xl"
        style={{ "--modal-max-width": maxWidth } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-4 flex items-center justify-between sticky top-0 -mx-4 sm:-mx-5 px-4 sm:px-5 -mt-4 sm:-mt-5 pt-4 sm:pt-5 pb-3 z-10"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <h3 className="text-base font-semibold pr-3">{title}</h3>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-lg leading-none transition hover:bg-[var(--hover)]"
            style={{ borderColor: "var(--border)", color: "var(--fg)", backgroundColor: "var(--bg)" }}
            onClick={onClose}
            aria-label="Close"
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
