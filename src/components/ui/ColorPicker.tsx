"use client";
import { useState } from "react";

const PRESETS = [
  "#e11d2a", // GoFood red
  "#00b14f", // Grab green
  "#ee4d2d", // Shopee orange
  "#f59e0b",
  "#facc15",
  "#22c55e",
  "#10b981",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
  "#f43f5e",
  "#0f172a",
  "#64748b"
];

export function ColorPicker({
  value,
  onChange
}: { value: string; onChange: (v: string) => void }) {
  const [hex, setHex] = useState(value || "#e11d2a");

  function commit(v: string) {
    if (/^#[0-9a-fA-F]{6}$/.test(v)) {
      const norm = v.toLowerCase();
      setHex(norm);
      onChange(norm);
    } else {
      setHex(v);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#e11d2a"}
          onChange={(e) => commit(e.target.value)}
          className="h-9 w-12 rounded border cursor-pointer p-0"
          style={{ borderColor: "var(--border)" }}
          aria-label="Pilih warna"
        />
        <input
          type="text"
          value={hex}
          onChange={(e) => commit(e.target.value)}
          placeholder="#e11d2a"
          maxLength={7}
          className="input font-mono uppercase"
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((c) => {
          const active = c.toLowerCase() === hex.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              onClick={() => commit(c)}
              title={c}
              className="h-6 w-6 rounded border transition hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: active ? "var(--fg)" : "var(--border)",
                outline: active ? "2px solid var(--fg)" : "none",
                outlineOffset: 1
              }}
              aria-label={`Pilih warna ${c}`}
            />
          );
        })}
      </div>
    </div>
  );
}
