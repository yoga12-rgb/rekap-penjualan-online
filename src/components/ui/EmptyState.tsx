import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className="card p-8 text-center flex flex-col items-center gap-2"
      style={{ color: "var(--muted)" }}
    >
      <Icon size={32} className="opacity-60" aria-hidden />
      <div className="text-base font-semibold" style={{ color: "var(--fg)" }}>
        {title}
      </div>
      {description && <p className="text-sm max-w-md">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}