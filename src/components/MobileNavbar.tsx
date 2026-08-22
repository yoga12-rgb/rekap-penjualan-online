"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  ClipboardList,
  Megaphone,
  Table,
  Package,
  Store,
  UtensilsCrossed,
  Users,
  Activity,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefWithCurrentOrPersistentParams } from "@/lib/urlParams";

type MainTab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type QuickItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function MobileNavbar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);

  // Close popup automatically whenever route/params change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname, searchParams]);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const leftTabs: MainTab[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transaksi", icon: ReceiptText },
  ];

  const rightTabs: MainTab[] = isAdmin
    ? [
        { href: "/reports/matrix", label: "Matriks", icon: Table },
        { href: "/surveys", label: "Survey", icon: ClipboardList },
      ]
    : [{ href: "/surveys", label: "Survey", icon: ClipboardList }];

  // Quick Action items inside popup
  const quickItems: QuickItem[] = isAdmin
    ? [
        { href: "/ad-costs", label: "Iklan", icon: Megaphone },
        { href: "/masters/products", label: "Produk", icon: Package },
        { href: "/masters/outlets", label: "Outlet", icon: Store },
        { href: "/masters/merchants", label: "Merchant", icon: UtensilsCrossed },
        { href: "/masters/users", label: "Kasir", icon: Users },
        { href: "/masters/user-presence", label: "Online", icon: Activity },
        { href: "/masters/surveys", label: "Survey", icon: ClipboardList },
      ]
    : [
        { href: "/ad-costs", label: "Biaya Iklan", icon: Megaphone },
        { href: "/surveys", label: "Survey Pelanggan", icon: ClipboardList },
      ];

  const isSubMenuRouteActive =
    pathname.startsWith("/ad-costs") || pathname.startsWith("/masters");

  function renderTab(tab: MainTab) {
    const isActive =
      pathname === tab.href ||
      (tab.href !== "/" && pathname.startsWith(tab.href + "/"));

    return (
      <Link
        key={tab.href}
        href={hrefWithCurrentOrPersistentParams(
          tab.href,
          pathname,
          searchParams,
        )}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 h-full py-1 px-1 rounded-full transition-all duration-200 active:scale-90",
          isActive
            ? "text-red-700 dark:text-red-300 font-semibold"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
        )}
      >
        <tab.icon
          size={20}
          className={cn(
            "transition-transform duration-200",
            isActive && "scale-110",
          )}
          strokeWidth={isActive ? 2.5 : 1.75}
        />
        <span className="text-[10px] font-medium leading-tight truncate max-w-full">
          {tab.label}
        </span>
        {isActive && (
          <span className="absolute top-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-red-600 dark:bg-red-400 shadow-sm shadow-red-500/50" />
        )}
      </Link>
    );
  }

  return (
    <>
      {/* Backdrop overlay when sub-menu is open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Navigasi Mobile Bawah"
        className="md:hidden fixed bottom-3.5 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px] z-50 pointer-events-none"
      >
        {/* Quick Hub Popup (Floating Capsule Above) */}
        <div
          className={cn(
            "absolute bottom-full mb-3 left-1/2 -translate-x-1/2 w-full max-w-[340px] sm:max-w-[400px] z-50 pointer-events-auto transition-all duration-250 ease-out origin-bottom",
            isOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-95 translate-y-4 pointer-events-none",
          )}
        >
          <div
            className="rounded-3xl border p-3.5 shadow-2xl backdrop-blur-2xl"
            style={{
              borderColor: "var(--border)",
              backgroundColor:
                "color-mix(in oklab, var(--card) 96%, var(--fg) 4%)",
              boxShadow:
                "0 20px 40px -8px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.05)",
            }}
          >
            <div
              className="flex items-center justify-between px-1.5 pb-2 mb-2 border-b"
              style={{ borderColor: "var(--border)" }}
            >
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                {isAdmin ? "Pintasan Master Data" : "Pintasan Menu"}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-200 transition-colors"
                aria-label="Tutup menu"
              >
                <X size={15} />
              </button>
            </div>

            <div
              className={cn(
                "grid gap-1.5",
                isAdmin ? "grid-cols-4" : "grid-cols-2",
              )}
            >
              {quickItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href + "/"));

                return (
                  <Link
                    key={item.href}
                    href={hrefWithCurrentOrPersistentParams(
                      item.href,
                      pathname,
                      searchParams,
                    )}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "group flex flex-col items-center justify-center p-1.5 rounded-2xl transition-all duration-150 active:scale-90",
                      isActive
                        ? "bg-red-500/15 text-red-600 dark:text-red-400 font-semibold"
                        : "hover:bg-[var(--hover)] text-slate-700 dark:text-slate-200",
                    )}
                  >
                    <div
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center mb-1 transition-transform group-hover:scale-105",
                        isActive
                          ? "bg-red-600 text-white shadow-md shadow-red-500/30"
                          : "bg-slate-100 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300",
                      )}
                    >
                      <item.icon
                        size={19}
                        strokeWidth={isActive ? 2.5 : 1.75}
                      />
                    </div>
                    <span className="text-[10px] leading-tight text-center truncate max-w-full font-medium">
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Floating Capsule Navbar */}
        <div
          className="pointer-events-auto flex items-center justify-between h-15 px-2 py-1 rounded-full border shadow-2xl backdrop-blur-xl transition-all"
          style={{
            borderColor: "var(--border)",
            backgroundColor:
              "color-mix(in oklab, var(--card) 95%, var(--fg) 5%)",
            boxShadow:
              "0 10px 30px -4px rgba(0,0,0,0.28), 0 2px 8px -1px rgba(0,0,0,0.12)",
          }}
        >
          {/* Left Tabs */}
          <div className="flex items-center justify-around flex-1">
            {leftTabs.map(renderTab)}
          </div>

          {/* Central Expandable Toggle Button (+) */}
          <div className="flex items-center justify-center px-1.5">
            <button
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              aria-label={isOpen ? "Tutup menu lainnya" : "Buka menu lainnya"}
              aria-expanded={isOpen}
              className={cn(
                "relative flex items-center justify-center h-11 w-11 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/35 transition-all duration-200 active:scale-90",
                isOpen && "bg-red-700 ring-2 ring-red-400/50",
                isSubMenuRouteActive &&
                  !isOpen &&
                  "ring-2 ring-red-500 ring-offset-2 dark:ring-offset-slate-900",
              )}
            >
              <Plus
                size={22}
                strokeWidth={2.5}
                className={cn(
                  "transition-transform duration-300 ease-in-out",
                  isOpen && "rotate-45",
                )}
              />
            </button>
          </div>

          {/* Right Tabs */}
          <div className="flex items-center justify-around flex-1">
            {rightTabs.map(renderTab)}
          </div>
        </div>
      </nav>
    </>
  );
}
