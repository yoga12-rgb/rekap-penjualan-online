import { requireProfile } from "@/lib/auth";
import { ToastHost } from "@/components/Toast";
import { LogoutButton } from "@/components/LogoutButton";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavProgress } from "@/components/NavProgress";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const isAdmin = profile.role === "super_admin";
  return (
    <div className="min-h-screen flex">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 min-w-0">
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b backdrop-blur px-6 py-3"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "color-mix(in oklab, var(--card) 80%, transparent)"
          }}
        >
          <div className="text-sm">
            <span className="font-medium">{profile.full_name ?? "User"}</span>
            <span className="badge ml-2">{profile.role}</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
      <ToastHost />
    </div>
  );
}
