import { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import MatrixClient from "./MatrixClient";

export const metadata: Metadata = {
  title: "Matriks Omset Harian",
};

export default async function MatrixPage() {
  const profile = await requireProfile();
  
  if (profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Matriks Omset Harian
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Laporan matriks pendapatan (crosstab) berdasarkan filter waktu mingguan dan bulanan.
        </p>
      </div>
      
      <Suspense fallback={<div className="p-12 text-center text-slate-500 animate-pulse">Memuat Matriks...</div>}>
        <MatrixClient />
      </Suspense>
    </div>
  );
}
