"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ReceiptText,
  Store,
  UtensilsCrossed,
  Package,
  Users,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Megaphone,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Item = { href: string; label: string; icon: LucideIcon };
type BodyWithSidebarLock = HTMLElement & {
  dataset: HTMLElement["dataset"] & { sidebarScrollLocks?: string };
};

const MAIN: Item[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transaksi", icon: ReceiptText },
  { href: "/ad-costs", label: "Biaya Iklan", icon: Megaphone },
];

const MASTERS: Item[] = [
  { href: "/masters/outlets", label: "Outlet", icon: Store },
  { href: "/masters/merchants", label: "Food Merchant", icon: UtensilsCrossed },
  { href: "/masters/products", label: "Produk & Varian", icon: Package },
  { href: "/masters/users", label: "Akun Kasir", icon: Users },
  { href: "/masters/user-presence", label: "User Online", icon: Activity },
];

export function Sidebar({
  isAdmin,
  initialCollapsed,
}: {
  isAdmin: boolean;
  initialCollapsed: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const previousBodyOverflow = useRef<string | null>(null);
  const pathname = usePathname();

  // Expose fungsi openSidebar via custom DOM event (dipakai MobileNavbar)
  useEffect(() => {
    function onOpenSidebar() {
      setOpen(true);
    }
    window.addEventListener("sidebar:open", onOpenSidebar);
    return () => window.removeEventListener("sidebar:open", onOpenSidebar);
  }, []);

  // Tutup drawer saat navigasi.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Cegah scroll body saat drawer terbuka tanpa menimpa scroll lock lain.
  useEffect(() => {
    const body = document.body as BodyWithSidebarLock;
    const currentLocks = Number(body.dataset.sidebarScrollLocks ?? "0");

    if (open) {
      if (currentLocks === 0) {
        previousBodyOverflow.current = body.style.overflow;
        body.style.overflow = "hidden";
      }
      body.dataset.sidebarScrollLocks = String(currentLocks + 1);
    }

    return () => {
      const nextLocks = Math.max(
        Number(body.dataset.sidebarScrollLocks ?? "0") - (open ? 1 : 0),
        0,
      );
      if (nextLocks === 0) {
        delete body.dataset.sidebarScrollLocks;
        if (previousBodyOverflow.current != null) {
          body.style.overflow = previousBodyOverflow.current;
          previousBodyOverflow.current = null;
        }
      } else {
        body.dataset.sidebarScrollLocks = String(nextLocks);
      }
    };
  }, [open]);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      document.cookie = `sidebar-collapsed=${next ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;
      return next;
    });
  }

  return (
    <>
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "z-50 w-64 shrink-0 border-r flex flex-col h-screen",
          "fixed inset-y-0 left-0 transition-[transform,width] duration-200",
          "md:sticky md:inset-y-auto md:top-0 md:translate-x-0",
          collapsed ? "md:w-20" : "md:w-60",
          open ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
      >
        <div
          className={cn(
            "p-4 border-b flex items-center justify-between gap-2",
            collapsed && "md:px-3 md:justify-center",
          )}
          style={{ borderColor: "var(--border)" }}
        >
          <div className={cn(collapsed && "md:hidden")}>
            <div className="font-bold text-lg leading-tight">Rajaklana</div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>
              Sales Recap
            </div>
          </div>
          <button
            onClick={toggleCollapsed}
            className="hidden md:inline-flex btn-ghost h-9 w-9 p-0"
            aria-label={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
            title={collapsed ? "Tampilkan sidebar" : "Sembunyikan sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen size={18} />
            ) : (
              <PanelLeftClose size={18} />
            )}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="md:hidden btn-ghost"
            aria-label="Tutup menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="p-2 text-sm flex-1 overflow-y-auto">
          {MAIN.map((it) => (
            <NavItem key={it.href} collapsed={collapsed} {...it} />
          ))}
          {isAdmin && (
            <>
              <div
                className={cn(
                  "px-3 pt-4 pb-1 text-xs font-semibold uppercase",
                  collapsed && "md:px-0 md:text-center",
                )}
                style={{ color: "var(--muted)" }}
              >
                <span className={cn(collapsed && "md:hidden")}>
                  Master Data
                </span>
                <span
                  className={cn(
                    "hidden",
                    collapsed &&
                      "md:mx-auto md:block md:h-px md:w-8 md:bg-[var(--border)]",
                  )}
                  aria-hidden
                />
              </div>
              {MASTERS.map((it) => (
                <NavItem key={it.href} collapsed={collapsed} {...it} />
              ))}
            </>
          )}
        </nav>
        <div
          className={cn("border-t p-3 text-[11px]", collapsed && "md:hidden")}
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          Copyright {new Date().getFullYear()} Rajaklana
        </div>
      </aside>
    </>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
}: Item & { collapsed: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 transition",
        collapsed && "md:justify-center md:px-2",
        active
          ? "bg-red-50 text-red-700 font-medium dark:bg-red-900/30 dark:text-red-300"
          : "hover:bg-[var(--hover)]",
      )}
      style={!active ? { color: "var(--fg)" } : undefined}
    >
      <Icon
        size={18}
        className={active ? "text-red-600 dark:text-red-300" : ""}
        style={!active ? { color: "var(--muted)" } : undefined}
      />
      <span className={cn(collapsed && "md:hidden")}>{label}</span>
    </Link>
  );
}
