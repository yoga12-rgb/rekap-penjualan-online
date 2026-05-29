"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  ReceiptText,
  Megaphone,
  Menu,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { hrefWithCurrentOrPersistentParams } from "@/lib/urlParams";

type TabItem = {
  href?: string;
  label: string;
  icon: LucideIcon;
  action?: () => void;
};

export function MobileNavbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function openSidebarDrawer() {
    window.dispatchEvent(new CustomEvent("sidebar:open"));
  }

  const TABS: TabItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transaksi", icon: ReceiptText },
    { href: "/ad-costs", label: "Iklan", icon: Megaphone },
    {
      label: "Lainnya",
      icon: Menu,
      action: openSidebarDrawer,
    },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-md"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "color-mix(in oklab, var(--card) 92%, transparent)",
      }}
    >
      <div className="flex justify-around items-center h-16 px-1 pb-safe">
        {TABS.map((tab) => {
          const isActive = tab.href
            ? pathname === tab.href ||
              (tab.href !== "/" && pathname.startsWith(tab.href + "/"))
            : false;

          const className = cn(
            "relative flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full py-1 px-1 rounded-lg transition-colors",
            isActive
              ? "text-red-700 dark:text-red-300"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300",
          );

          if (tab.href) {
            return (
              <Link
                key={tab.href}
                href={hrefWithCurrentOrPersistentParams(
                  tab.href,
                  pathname,
                  searchParams,
                )}
                aria-current={isActive ? "page" : undefined}
                className={className}
              >
                <tab.icon
                  size={22}
                  className={cn(
                    "transition-transform",
                    isActive && "scale-110",
                  )}
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span
                  className={cn(
                    "text-[10px] font-medium leading-tight truncate max-w-full",
                    isActive && "font-semibold",
                  )}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-red-600 dark:bg-red-400" />
                )}
              </Link>
            );
          }

          return (
            <button
              key={tab.label}
              onClick={tab.action}
              type="button"
              className={className}
            >
              <tab.icon size={22} strokeWidth={1.5} />
              <span className="text-[10px] font-medium leading-tight truncate max-w-full">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
