import { AlertTriangle, RotateCw } from "lucide-react";

export function ErrorState({
  title = "Terjadi kesalahan",
  message,
  onRetry,
  retryText = "Coba lagi",
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryText?: string;
}) {
  return (
    <div className="card p-8 text-center flex flex-col items-center gap-2">
      <AlertTriangle size={32} className="text-red-600" aria-hidden />
      <div className="text-base font-semibold" style={{ color: "var(--fg)" }}>
        {title}
      </div>
      {message && <p className="text-sm max-w-md">{message}</p>}
      {onRetry && (
        <button type="button" className="btn-outline mt-2" onClick={onRetry}>
          <RotateCw size={14} />
          {retryText}
        </button>
      )}
    </div>
  );
}