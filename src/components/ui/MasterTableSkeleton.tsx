import { Skeleton } from "@/components/ui/Skeleton";

export function MasterTableSkeleton({ title, cols = 4, rows = 8 }: {
  title: string;
  cols?: number;
  rows?: number;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-56" aria-label={title} />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="card overflow-hidden">
        <div className="grid p-3 gap-3 border-b" style={{
          gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
          borderColor: "var(--border)"
        }}>
          {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 w-24" />)}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="grid p-3 gap-3 border-b" style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`,
            borderColor: "var(--border)"
          }}>
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
