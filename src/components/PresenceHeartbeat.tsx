"use client";

import { useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";

const HEARTBEAT_INTERVAL_MS = 60_000;

export function PresenceHeartbeat() {
  const pathname = usePathname();

  const ping = useCallback(() => {
    if (document.visibilityState === "hidden") return;
    void fetch("/api/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: pathname,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    ping();
    const interval = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);
    window.addEventListener("focus", ping);
    document.addEventListener("visibilitychange", ping);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", ping);
      document.removeEventListener("visibilitychange", ping);
    };
  }, [ping]);

  return null;
}
