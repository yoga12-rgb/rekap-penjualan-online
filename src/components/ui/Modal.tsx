"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  children,
  closeOnBackdrop = false,
  size = "md",
  bodyScroll = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  closeOnBackdrop?: boolean;
  size?: "md" | "lg" | "xl";
  bodyScroll?: boolean;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const previousBodyOverflow = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    previousBodyOverflow.current = document.body.style.overflow;
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      if (previousBodyOverflow.current != null) {
        document.body.style.overflow = previousBodyOverflow.current;
        previousBodyOverflow.current = null;
      }
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
  const panelSizeClass = bodyScroll
    ? "max-h-[92dvh] rounded-b-none sm:rounded-lg"
    : "h-[100dvh] max-h-[100dvh] rounded-none sm:h-[92dvh] sm:max-h-[92dvh] sm:rounded-lg";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/65 sm:p-4"
      onClick={() => { if (closeOnBackdrop) onClose(); }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`card flex w-screen max-w-[100vw] flex-col overflow-hidden p-4 shadow-2xl sm:w-full sm:max-w-[var(--modal-max-width)] sm:p-5 ${panelSizeClass}`}
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
            <X size={18} />
          </button>
        </div>
        <div
          className={
            bodyScroll
              ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
              : "min-h-0 flex-1 overflow-hidden"
          }
        >
          {children}
        </div>
      </div>
    </div>
  );
}
