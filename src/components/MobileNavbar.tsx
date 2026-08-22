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
  Menu,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefWithCurrentOrPersistentParams } from "@/lib/urlParams";

type MainTab = {
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

  function openSidebarDrawer() {
    window.dispatchEvent(new CustomEvent("sidebar:open"));
  }

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
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Navigasi Mobile Bawah"
        className="md:hidden fixed bottom-3.5 left-3 right-3 sm:left-1/2 sm:-translate-x-1/2 sm:w-[440px] z-50 pointer-events-none"
      >
        {/* Expandable Sub-Menu (Floating Capsule Above) */}
        <div
          className={cn(
            "absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-50 pointer-events-auto transition-all duration-200 ease-out origin-bottom",
            isOpen
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-3 pointer-events-none",
          )}
        >
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-full border shadow-2xl backdrop-blur-xl"
            style={{
              borderColor: "var(--border)",
              backgroundColor:
                "color-mix(in oklab, var(--card) 95%, var(--fg) 5%)",
              boxShadow: "0 14px 36px -4px rgba(0,0,0,0.35)",
            }}
          >
            {/* 1. Biaya Iklan */}
            <Link
              href={hrefWithCurrentOrPersistentParams(
                "/ad-costs",
                pathname,
                searchParams,
              )}
              onClick={() => setIsOpen(false)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-full transition-all active:scale-90",
                pathname.startsWith("/ad-costs")
                  ? "text-red-700 dark:text-red-300 font-semibold bg-red-500/15"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              <Megaphone
                size={18}
                strokeWidth={pathname.startsWith("/ad-costs") ? 2.5 : 1.75}
              />
              <span className="text-[10px] font-medium leading-tight">
                Iklan
              </span>
            </Link>

            <div
              className="w-[1px] h-6 my-auto"
              style={{ backgroundColor: "var(--border)" }}
            />

            {/* 2. Menu Lengkap (Buka Sidebar Drawer) */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openSidebarDrawer();
              }}
              className="flex flex-col items-center justify-center gap-0.5 px-4 py-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all active:scale-90"
            >
              <Menu size={18} strokeWidth={1.75} />
              <span className="text-[10px] font-medium leading-tight whitespace-nowrap">
                Lainnya
              </span>
            </button>
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
