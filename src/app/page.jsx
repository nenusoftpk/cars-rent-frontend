"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth, PLATFORM_ROUTES } from "@/hooks/useAuth";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

export default function Home() {
  const router = useRouter();

  const {
    ready,
    isAuthenticated,
    isSuperAdmin,
    isBusinessUser,
  } = useAuth();

  useEffect(() => {
    if (!ready) return;

    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }

    if (isSuperAdmin) {
      router.replace(PLATFORM_ROUTES.DASHBOARD);
      return;
    }

    if (isBusinessUser) {
      router.replace("/dashboard");
      return;
    }

    router.replace("/login");
  }, [
    ready,
    isAuthenticated,
    isSuperAdmin,
    isBusinessUser,
    router,
  ]);

  return <LoadingScreen />;
}