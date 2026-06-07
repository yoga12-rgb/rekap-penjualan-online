import type { ReactNode } from "react";
import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

function DisabledField({
  label,
  value = "Memuat...",
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div
        className="input flex items-center"
        aria-hidden="true"
        style={{ color: "var(--muted)" }}
      >
        {value}
      </div>
    </div>
  );
}

function PresetPill({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="btn-ghost h-8 shrink-0 px-3 text-xs"
      disabled
    >
      {children}
    </button>
  );
}

export default function DashboardLoading() {
  return (
    <div className="space-y-3 sm:space-y-4 animate-fade-in">
      <div className="card p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <span>Filter</span>
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg)",
                color: "var(--muted)",
              }}
            >
              Memuat data
            </span>
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <button className="btn-ghost h-9 px-3 text-xs sm:text-sm" disabled>
              Reset
            </button>
            <button
              className="btn-primary h-9 flex-1 px-3 text-xs font-semibold shadow-sm sm:flex-none sm:text-sm"
              disabled
            >
              Terapkan Filter
            </button>
            <button
              className="btn-primary h-9 flex-1 px-3 text-xs sm:flex-none sm:text-sm"
              disabled
            >
              Export Tren
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <DisabledField label="Dari" value="Tanggal awal" />
          <DisabledField label="Sampai" value="Tanggal akhir" />
          <DisabledField label="Outlet" value="Semua Outlet" />
          <DisabledField label="Merchant" value="Semua Merchant" />
          <DisabledField label="Varian Produk" value="Semua Varian" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <PresetPill>Hari ini</PresetPill>
          <PresetPill>7H</PresetPill>
          <PresetPill>30H</PresetPill>
          <PresetPill>Bulan ini</PresetPill>
          <PresetPill>Bulan lalu</PresetPill>
          <PresetPill>YTD</PresetPill>
          <PresetPill>Tahun</PresetPill>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div
        className="flex overflow-x-auto border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {["Tren", "Produk", "Merchant", "Outlet", "Jam", "Insight"].map(
          (tab, index) => (
            <button
              key={tab}
              type="button"
              className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 ${
                index === 0 ? "text-red-700 dark:text-red-300" : ""
              }`}
              style={{
                borderColor: index === 0 ? "#b91c1c" : "transparent",
                color: index === 0 ? undefined : "var(--muted)",
              }}
              disabled
            >
              {tab}
            </button>
          ),
        )}
      </div>

      <div className="card p-4">
        <Skeleton className="mb-3 h-4 w-48" />
        <Skeleton className="h-72 w-full" />
      </div>
    </div>
  );
}
