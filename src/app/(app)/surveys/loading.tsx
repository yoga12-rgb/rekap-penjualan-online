import { MasterTableSkeleton } from "@/components/ui/MasterTableSkeleton";

export default function SurveysLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-7 w-44 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-10 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <MasterTableSkeleton title="Memuat survey" rows={6} cols={4} />
    </div>
  );
}
