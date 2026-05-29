"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Sun, Moon, Monitor } from "lucide-react";
import {
  THEME_PARAM,
  queryString,
  themeParam,
  type ThemeParam,
} from "@/lib/urlParams";

function applyTheme(theme: ThemeParam) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const theme = themeParam(searchParams.get(THEME_PARAM));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    applyTheme(theme);
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => applyTheme("system");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [theme, mounted]);

  function setTheme(nextTheme: ThemeParam) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(THEME_PARAM, nextTheme);
    router.replace(`${pathname}${queryString(next)}`, { scroll: false });
  }

  if (!mounted) {
    return <div className="w-[110px] h-9" aria-hidden />;
  }

  const opts: { v: ThemeParam; icon: any; label: string }[] = [
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
