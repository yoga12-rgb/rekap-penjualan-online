"use client";
import { useEffect, useState } from "react";
import Image from "next/image";

export function SplashScreen() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Check if splash was already shown in this tab/window session
    const hasShown = sessionStorage.getItem("splash_shown_v1");
    if (hasShown) {
      setVisible(false);
      return;
    }

    // Display splash for 900ms then smoothly fade out
    const timer = setTimeout(() => {
      setFading(true);
      sessionStorage.setItem("splash_shown_v1", "true");
      const removeTimer = setTimeout(() => {
        setVisible(false);
      }, 500); // 500ms fade out animation
      return () => clearTimeout(removeTimer);
    }, 850);

    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-[#0b1220] transition-opacity duration-500 ease-out ${
        fading ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      style={{ minHeight: "100dvh" }}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center justify-center p-6 text-center animate-fade-in">
        {/* Logo Monogram RK */}
        <div className="relative w-28 h-28 sm:w-36 sm:h-36 mb-6 drop-shadow-lg">
          <Image
            src="/icons/icon-512.png"
            alt="Rajaklana"
            fill
            sizes="(max-width: 640px) 112px, 144px"
            priority
            className="object-contain"
          />
        </div>

        {/* Brand Subtitle Typography */}
        <h1 className="text-sm sm:text-base font-bold tracking-widest text-slate-800 dark:text-slate-100 uppercase">
          ONLINE SELLS &amp; SURVEY
        </h1>

        {/* Subtle Loading Progress Bar */}
        <div className="w-24 h-1 mt-8 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div className="h-full w-full bg-red-600 rounded-full animate-progress" />
        </div>
      </div>
    </div>
  );
}
