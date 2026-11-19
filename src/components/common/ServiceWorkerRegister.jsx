"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Only register in production (or when you explicitly want to test)
    if (process.env.NODE_ENV !== "production" && !process.env.NEXT_PUBLIC_ENABLE_SW) {
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Optional: force update check
        reg.update();
      })
      .catch((err) => {
        console.warn("Service worker registration failed:", err);
      });
  }, []);

  return null;
}