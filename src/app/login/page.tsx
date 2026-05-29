import { LoginForm } from "./LoginForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Suspense } from "react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white dark:from-slate-900 dark:to-slate-950 p-4">
      <div className="card w-full max-w-md p-6">
        <div className="mb-6 text-center relative">
          <div className="absolute right-0 top-0">
            <Suspense fallback={<div className="w-[110px] h-9" aria-hidden />}>
              <ThemeToggle />
            </Suspense>
          </div>
          <h1 className="text-2xl font-bold">Rajaklana</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>Sistem Rekap Penjualan Abon Gulung</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
