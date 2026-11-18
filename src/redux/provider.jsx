"use client";

import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { Toaster } from "sonner";

import { makeStore } from "./store";
import { hydrate } from "./slices/authSlice";

const STORAGE_KEY = "rac_auth";

// ======================================================
// LOAD SAVED SESSION
// ======================================================


const readSession = () => {
  if (typeof window === "undefined") {
    return null;
  }

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

    // Check JWT expiry without treating this as
    // verification of the token's authenticity.
    const parts = parsed.token.split(".");

    if (parts.length !== 3) {
      return null;
    }

    const payload = JSON.parse(
      atob(
        parts[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/")
          .padEnd(
            Math.ceil(parts[1].length / 4) * 4,
            "="
          )
      )
    );

    if (
      typeof payload.exp !== "number" ||
      payload.exp * 1000 <= Date.now()
    ) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return {
      token: parsed.token,
      user: parsed.user,
    };
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
    const session = readSession();

    storeRef.current.dispatch(hydrate(session));
  }, []);

  return (
    <Provider store={storeRef.current}>
      {children}

      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: "inherit",
          },
        }}
      />
    </Provider>
  );
}