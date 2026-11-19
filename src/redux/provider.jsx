"use client";

import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { Toaster } from "sonner";

import { makeStore } from "./store";
import { hydrate } from "./slices/authSlice";
import { jwtExpiryMs, canKeepExpiredSession } from "@/offline/session";

const STORAGE_KEY = "rac_auth";

// ======================================================
// LOAD SAVED SESSION
// ======================================================

const readSession = () => {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.token !== "string" ||
      !parsed.token ||
      !parsed.user ||
      typeof parsed.user !== "object"
    ) {
      return null;
    }

    // Expiry is read from the JWT payload. This is NOT verification of authenticity.
    const expiresAt = jwtExpiryMs(parsed.token);

    if (expiresAt === null) return null;

    if (expiresAt <= Date.now()) {
      // OFFLINE SESSION POLICY (see src/offline/session.js):
      // an expired token is only kept while the browser is offline AND the user was verified
      // by the server within OFFLINE_SESSION_DAYS. The token is never renewed locally; the
      // first request that reaches the server gets a 401 and the normal logout flow runs.
      if (canKeepExpiredSession(parsed.user)) {
        return { token: parsed.token, user: parsed.user };
      }
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
};

// ======================================================
// REDUX PROVIDER
// ======================================================

export default function ReduxProvider({ children }) {
  const storeRef = useRef(null);

  if (!storeRef.current) {
    storeRef.current = makeStore();
  }

  useEffect(() => {
    storeRef.current.dispatch(hydrate(readSession()));
  }, []);

  return (
    <Provider store={storeRef.current}>
      {children}

      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "inherit" } }}
      />
    </Provider>
  );
}