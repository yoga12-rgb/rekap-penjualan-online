"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronsUpDown, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComboOption = { value: string; label: string; hint?: string };

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "-- pilih --",
  disabled = false,
  clearable = false,
  className,
}: {
  options: ComboOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top: number;
    left: number;
    width: number;
  }>({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  // Hitung posisi dropdown saat dibuka
  useEffect(() => {
    if (open && wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  }, [open]);

  // close on outside click
  useEffect(() => {
    function onDoc(e: PointerEvent) {
      const target = e.target as Node;
      const isInsideTrigger = wrapRef.current?.contains(target);
      const isInsideDropdown = dropdownRef.current?.contains(target);

      if (!isInsideTrigger && !isInsideDropdown) {
        setOpen(false);
      }
    }

    if (open) document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  // focus input when opened
  useEffect(() => {
    if (open) {
      setHighlight(0);
      const canAutoFocus = window.matchMedia(
        "(hover: hover) and (pointer: fine)",
      ).matches;
      if (canAutoFocus) setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
    }
  }, [open]);

  // keep highlighted item in view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx='${highlight}']`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, filtered.length]);

  // Update posisi saat resize/scroll
  useEffect(() => {
    if (!open) return;
    function updatePos() {
      if (wrapRef.current) {
        const rect = wrapRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    }
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, true);
    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos, true);
    };
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt.value);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const dropdown = open && (
    <div
      ref={dropdownRef}
      className="pointer-events-auto fixed z-[9999] rounded-md border shadow-lg overflow-hidden"
      style={{
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        maxWidth: "calc(100vw - 16px)",
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
      }}
    >
      <div
        className="flex items-center gap-2 px-2 py-1.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        <Search size={14} className="text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(0);
          }}
          onKeyDown={onKey}
          placeholder="Cari..."
          className="w-full bg-transparent text-sm outline-none"
        />
      </div>
      <div ref={listRef} className="max-h-56 overflow-auto py-1">
        {filtered.length === 0 ? (
          <div
            className="px-3 py-3 text-sm text-center"
            style={{ color: "var(--muted)" }}
          >
            Tidak ada hasil
          </div>
        ) : (
          filtered.map((o, idx) => {
            const active = idx === highlight;
            const isSel = o.value === value;
            return (
              <button
                type="button"
                key={o.value}
                data-idx={idx}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => pick(o.value)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm flex items-center gap-2",
                  active && "bg-[var(--hover)]",
                )}
              >
                <Check
                  size={14}
                  className={cn(
                    "shrink-0",
                    isSel ? "opacity-100 text-red-600" : "opacity-0",
                  )}
                />
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && (
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {o.hint}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={cn(
          "input flex items-center justify-between gap-2 text-left",
          disabled && "opacity-60 cursor-not-allowed",
        )}
      >
        <span className={cn("truncate", !selected && "text-slate-400")}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1 text-slate-400">
          {clearable && selected && !disabled && (
            <X
              size={14}
              className="hover:text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
            />
          )}
          <ChevronsUpDown size={14} />
        </span>
      </button>

      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
