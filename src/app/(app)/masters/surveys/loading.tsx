import { MasterTableSkeleton } from "@/components/ui/MasterTableSkeleton";

export default function SurveyMasterLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="h-7 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-10 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <MasterTableSkeleton title="Memuat pertanyaan survey" rows={5} cols={4} />
        <MasterTableSkeleton title="Memuat jawaban survey" rows={5} cols={4} />
      </div>
    </div>
  );
}
