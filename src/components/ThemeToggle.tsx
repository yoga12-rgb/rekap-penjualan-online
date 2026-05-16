"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as Theme) || "system";
    setTheme(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem("theme", theme);
    applyTheme(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme, mounted]);

  if (!mounted) {
    return <div className="w-[110px] h-9" aria-hidden />;
  }

  const opts: { v: Theme; icon: any; label: string }[] = [
    { v: "light", icon: Sun, label: "Light" },
    { v: "dark", icon: Moon, label: "Dark" },
    { v: "system", icon: Monitor, label: "System" }
  ];

  return (
    <div
      className="inline-flex items-center rounded-md border p-0.5"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      role="group"
      aria-label="Theme toggle"
    >
      {opts.map((o) => {
        const Icon = o.icon;
        const active = theme === o.v;
        return (
          <button
            key={o.v}
            onClick={() => setTheme(o.v)}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition ${
              active
                ? "bg-red-600 text-white"
                : "hover:bg-[var(--hover)] text-slate-600 dark:text-slate-300"
            }`}
            title={o.label}
            aria-pressed={active}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
