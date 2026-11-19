"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.NEXT_PUBLIC_ENABLE_SW !== "true"
    ) {
      return;
    }

    let cancelled = false;

    async function registerWorker() {
      try {
        const registration =
          await navigator.serviceWorker.register(
            "/sw.js",
            {
              scope: "/",
              updateViaCache: "none",
            }
          );

        if (cancelled) return;

        console.log(
          "[CarsRent] Service Worker ready",
          registration.scope
        );

        try {
          await registration.update();
        } catch (error) {
          console.warn(
            "[CarsRent] Update unavailable:",
            error
          );
        }
      } catch (error) {
        console.error(
          "[CarsRent] Registration failed:",
          error
        );
      }
    }

    registerWorker();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}