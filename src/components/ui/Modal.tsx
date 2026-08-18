"use client";
import { useEffect, useId, useRef, type CSSProperties } from "react";
import { X } from "lucide-react";
import { useScrollLock } from "@/lib/useScrollLock";

const FOCUSABLE_SELECTOR = [
  "input:not([type='hidden']):not(:disabled)",
  "select:not(:disabled)",
  "textarea:not(:disabled)",
  "button:not(:disabled)",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusables(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

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
  const triggerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  useScrollLock(open);

  // Selalu simpan onClose terbaru agar listener tidak perlu di-rebind.
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Focus trap + Escape saat terbuka.
  useEffect(() => {
    if (!open) return;
    triggerRef.current = document.activeElement as HTMLElement | null;

    const frameId = requestAnimationFrame(() => {
      const first = getFocusables(contentRef.current ?? document.body)[0];
      (first ?? contentRef.current)?.focus();
    });

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const container = contentRef.current;
      if (!container) return;

      const focusables = getFocusables(container);
      if (focusables.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Kembalikan fokus ke trigger saat modal ditutup.
  useEffect(() => {
    if (open) return;
    triggerRef.current?.focus?.();
    triggerRef.current = null;
  }, [open]);

  if (!open) return null;

  const maxWidth = size === "xl" ? "56rem" : size === "lg" ? "42rem" : "32rem";
  const panelSizeClass = bodyScroll
    ? "max-h-[92dvh] rounded-b-none sm:rounded-lg"
    : "h-[100dvh] max-h-[100dvh] rounded-none sm:h-[92dvh] sm:max-h-[92dvh] sm:rounded-lg";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/65 sm:p-4"
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card flex w-screen max-w-[100vw] flex-col overflow-hidden p-4 shadow-2xl outline-none sm:w-full sm:max-w-[var(--modal-max-width)] sm:p-5 ${panelSizeClass}`}
        style={{ "--modal-max-width": maxWidth } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mb-4 flex items-center justify-between sticky top-0 -mx-4 sm:-mx-5 px-4 sm:px-5 -mt-4 sm:-mt-5 pt-4 sm:pt-5 pb-3 z-10"
          style={{
            backgroundColor: "var(--card)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h3 id={titleId} className="text-base font-semibold pr-3">
            {title}
          </h3>
          <button
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border text-lg leading-none transition hover:bg-[var(--hover)]"
            style={{
              borderColor: "var(--border)",
              color: "var(--fg)",
              backgroundColor: "var(--bg)",
            }}
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