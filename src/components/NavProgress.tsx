"use client";
import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Top progress bar yang muncul setiap kali pathname / searchParams berubah.
 * Memberi feedback visual saat Server Component sedang re-render filter dsb.
 */
export function NavProgress() {
  const pathname = usePathname();
  const params = useSearchParams();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setVisible(true);
    setProgress(15);
    const t1 = setTimeout(() => setProgress(60), 100);
    const t2 = setTimeout(() => setProgress(90), 350);
    const t3 = setTimeout(() => {
      setProgress(100);
      setTimeout(() => { setVisible(false); setProgress(0); }, 200);
    }, 600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pathname, params]);

  return (
    <div
      className="fixed left-0 top-0 z-[60] h-0.5 bg-red-600 transition-all duration-200"
      style={{
        width: `${progress}%`,
        opacity: visible ? 1 : 0,
        boxShadow: "0 0 8px rgba(220,38,38,.6)"
      }}
    />
  );
}
