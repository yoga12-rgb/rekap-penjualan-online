"use client";

import { useEffect } from "react";

/**
 * Shared scroll-lock utility with a global counter, so multiple components
 * (Modal, Sidebar drawer, etc.) can lock <body> simultaneously without
 * clobbering each other's overflow style.
 */
const STORAGE_KEY = "scroll-lock-count";

function readCount(): number {
  if (typeof window === "undefined") return 0;
  return Number(window.document.body.dataset[STORAGE_KEY] ?? "0");
}

function writeCount(count: number) {
  if (typeof window === "undefined") return;
  const body = window.document.body;
  if (count <= 0) {
    delete body.dataset[STORAGE_KEY];
    body.style.overflow = "";
  } else {
    body.dataset[STORAGE_KEY] = String(count);
    body.style.overflow = "hidden";
  }
}

export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    writeCount(readCount() + 1);

    return () => {
      writeCount(Math.max(0, readCount() - 1));
    };
  }, [locked]);
}