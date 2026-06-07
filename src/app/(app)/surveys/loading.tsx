import { MasterTableSkeleton } from "@/components/ui/MasterTableSkeleton";

export default function SurveysLoading() {
  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl font-bold">Survey Customer</h1>
        </div>
        <div
          className="inline-flex rounded-md border p-1"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--card)",
          }}
        >
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold"
            style={{
              backgroundColor: "var(--brand)",
              color: "white",
            }}
            disabled
          >
            Input
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded px-3 py-2 text-sm font-semibold"
            style={{ color: "var(--muted)" }}
            disabled
          >
            Laporan
          </button>
        </div>
      </div>
      <MasterTableSkeleton title="Memuat survey" rows={6} cols={4} />
    </div>
  );
}
