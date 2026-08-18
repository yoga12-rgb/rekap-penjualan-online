"use client";
import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineIndicator() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function update() {
      setOffline(!navigator.onLine);
    }
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="fixed bottom-20 left-1/2 z-[90] -translate-x-1/2 md:bottom-4 md:left-auto md:right-4 md:translate-x-0 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg"
      style={{
        backgroundColor: "var(--card)",
        borderColor: "var(--border)",
        color: "var(--fg)",
      }}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-1.5">
        <WifiOff size={13} className="text-red-600" />
        Offline — data mungkin tidak terbaru
      </span>
    </div>
  );
}