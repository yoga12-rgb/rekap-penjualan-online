import type { ReactNode } from "react";
import { Plus } from "lucide-react";
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

function PresetButton({ children }: { children: ReactNode }) {
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

export default function AdCostsLoading() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Biaya Iklan Harian</h1>
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            Satu record per tanggal, outlet, dan merchant.
          </p>
        </div>
        <button className="btn-primary" disabled>
          <Plus size={16} /> Tambah Biaya
        </button>
      </div>

      <div className="card p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Filter
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
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <DisabledField label="Dari" value="Tanggal awal" />
          <DisabledField label="Sampai" value="Tanggal akhir" />
          <DisabledField label="Outlet" value="Semua outlet" />
          <DisabledField label="Merchant" value="Semua merchant" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          <PresetButton>Hari ini</PresetButton>
          <PresetButton>7H</PresetButton>
          <PresetButton>30H</PresetButton>
          <PresetButton>Bulan ini</PresetButton>
          <PresetButton>Bulan lalu</PresetButton>
          <PresetButton>YTD</PresetButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      <div className="card overflow-hidden">
        <div className="hidden grid-cols-[1fr_1.2fr_1.2fr_1fr_1.4fr_64px] gap-3 border-b p-3 text-xs font-semibold uppercase sm:grid">
          <span>Tanggal</span>
          <span>Outlet</span>
          <span>Merchant</span>
          <span className="text-right">Biaya Iklan</span>
          <span>Catatan</span>
          <span />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
