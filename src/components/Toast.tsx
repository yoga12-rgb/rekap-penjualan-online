"use client";
import { useEffect, useState } from "react";

let pushFn: ((m: string, t?: "info" | "error" | "success") => void) | null = null;
export function toast(m: string, t: "info" | "error" | "success" = "info") {
  pushFn?.(m, t);
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; m: string; t: string }[]>([]);
  useEffect(() => {
    pushFn = (m, t = "info") => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s, { id, m, t }]);
      setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3500);
    };
    return () => { pushFn = null; };
  }, []);
  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {items.map((i) => (
        <div
          key={i.id}
          className={`rounded-md px-3 py-2 text-sm shadow-lg ${
            i.t === "error" ? "bg-red-600 text-white"
              : i.t === "success" ? "bg-emerald-600 text-white"
              : "bg-slate-800 text-white"
          }`}
        >
          {i.m}
        </div>
      ))}
    </div>
  );
}
