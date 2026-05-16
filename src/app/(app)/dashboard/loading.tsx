import { Skeleton, SkeletonCard } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-5 animate-fade-in">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-36" />
          </div>
        ))}
        <Skeleton className="h-9 w-28 ml-auto" />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>

      {/* Big chart */}
      <div className="card p-4">
        <Skeleton className="h-4 w-48 mb-3" />
        <Skeleton className="h-72 w-full" />
      </div>

      {/* Two charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="card p-4">
            <Skeleton className="h-4 w-40 mb-3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ))}
      </div>

      {/* Tabel detail */}
      <div className="card p-4">
        <Skeleton className="h-4 w-40 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
