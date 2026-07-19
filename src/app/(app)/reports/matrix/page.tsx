import { Metadata } from "next";
import { requireProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
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
    <div className="mx-auto w-full max-w-[1400px] p-4 lg:p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Matriks Omset Harian
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Laporan matriks pendapatan (crosstab) berdasarkan filter waktu mingguan, bulanan, dan tahunan.
        </p>
      </div>
      
      <MatrixClient />
    </div>
  );
}
