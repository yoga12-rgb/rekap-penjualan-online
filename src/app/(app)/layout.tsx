import { requireProfile } from "@/lib/auth";
import { ToastHost } from "@/components/Toast";
import { LogoutButton } from "@/components/LogoutButton";
import { Sidebar } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NavProgress } from "@/components/NavProgress";
import { PresenceHeartbeat } from "@/components/PresenceHeartbeat";
import { MobileNavbar } from "@/components/MobileNavbar";
import { cookies } from "next/headers";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();
  const cookieStore = await cookies();
  const isAdmin = profile.role === "super_admin";
  const initialSidebarCollapsed =
    cookieStore.get("sidebar-collapsed")?.value === "1";
  return (
    <div className="min-h-screen flex">
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <PresenceHeartbeat />
      <Sidebar isAdmin={isAdmin} initialCollapsed={initialSidebarCollapsed} />
      <main className="flex-1 min-w-0 w-full">
        <header
          className="sticky top-0 z-20 flex items-center justify-between border-b backdrop-blur px-4 sm:px-6 py-3 pl-14 md:pl-6"
          style={{
            borderColor: "var(--border)",
            backgroundColor:
              "color-mix(in oklab, var(--card) 80%, transparent)",
          }}
        >
          <div className="text-sm min-w-0">
            <span className="font-medium truncate inline-block max-w-[140px] sm:max-w-none align-bottom">
              {profile.full_name ?? "User"}
            </span>
            <span className="badge ml-2">{profile.role}</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <LogoutButton />
          </div>
        </header>
        <div className="p-4 sm:p-6 pb-24 md:pb-6">{children}</div>
      </main>
      <MobileNavbar isAdmin={isAdmin} />
      <ToastHost />
    </div>
  );
}
