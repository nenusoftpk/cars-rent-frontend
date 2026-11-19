import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { sessionExpired } from "../slices/authSlice";
import { setPending } from "../slices/syncSlice";

import {
  executeOffline,
  isNetworkFailure,
  isBrowserOnline,
  supportsOfflineAction,
  getOfflineRecordStatus,
} from "@/offline/offlineAdapter";
import { classifyRequest, rewriteRequestId, normalizePath } from "@/offline/routes";
import { resolveContext, markVerified, isWithinOfflineWindow } from "@/offline/session";
import {
  saveSnapshot, readSnapshot, dropSnapshot, dropStaleSnapshots, isHydrated, mergeServerRecords,
} from "@/offline/queryCache";
import { TABLE } from "@/offline/localQuries";
import { getMappedId, isLocalId } from "@/offline/db";
import { getPendingCount, hasPending } from "@/offline/outbox";
import { getMeta } from "@/offline/cache";

// ======================================================
// CONFIGURATION
// ======================================================

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1").replace(/\/+$/, "");

const AUTH_STORAGE_KEY = "rac_auth";

// ======================================================
// REAL BACKEND QUERY
// ======================================================

const realBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  prepareHeaders: (headers, { getState }) => {
    const token = getState()?.auth?.token;
    if (token) headers.set("Authorization", `Bearer ${token}`);
    else headers.delete("Authorization");
    headers.set("Accept", "application/json");
    return headers; // fetchBaseQuery handles JSON and FormData
  },
});

// ======================================================
// BACKEND RESPONSE UNWRAPPING (unchanged)
// ======================================================

const unwrapResponse = (response) => {
  if (
    response &&
    typeof response === "object" &&
    !Array.isArray(response) &&
    Object.prototype.hasOwnProperty.call(response, "data") &&
    (Object.prototype.hasOwnProperty.call(response, "success") ||
      Object.prototype.hasOwnProperty.call(response, "message"))
  ) {
    return response.data;
  }
  return response;
};

// ======================================================
// PUBLIC AUTH ROUTES (unchanged)
// ======================================================

const PUBLIC_AUTH_ROUTES = new Set([
  "/auth/signup",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
]);

const isPublicAuthRequest = (url) => PUBLIC_AUTH_ROUTES.has(normalizePath(url));

const removeSavedSession = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be disabled.
  }
};

// ======================================================
// OFFLINE SERVING
// ======================================================

const adminFilter = (ctx) => (record) => String(record.businessId) === ctx.businessId;

const unavailable = (message) => ({
  error: {
    status: "FETCH_ERROR",
    error: message,
    data: { success: false, message },
  },
});

const NOT_DOWNLOADED = "This data has not been saved on this device yet. Open it once while online.";
const EXPIRED = "Offline access has expired. Connect to the internet and sign in again.";

async function offlineAllowed(ctx) {
  const lastSync = await getMeta(`lastSyncAt:${ctx.businessId}`);
  return isWithinOfflineWindow(ctx.userId, lastSync ? Date.parse(lastSync) : 0);
}

async function serveRead(route, ctx) {
  if (!(await offlineAllowed(ctx))) return unavailable(EXPIRED);

  const local = Boolean(route.entity) && ctx.isAdmin;

  if (local) {
    const table = TABLE[route.entity];
    const base = { entity: route.entity, businessId: ctx.businessId, accessFilter: adminFilter(ctx) };

    if (route.action === "list") {
      const pending = await hasPending(ctx.businessId, route.entity);
      // Exact server answer when nothing is waiting to sync; otherwise local data incl. pending rows.
      if (!pending) {
        const snap = await readSnapshot(ctx, route);
        if (snap) return { data: snap.data };
      }
      if (await isHydrated(ctx.businessId, table)) {
        return executeOffline({ ...base, action: "list", params: route.params });
      }
      const snap = await readSnapshot(ctx, route);
      if (snap) return { data: snap.data };
      return pending ? executeOffline({ ...base, action: "list", params: route.params }) : unavailable(NOT_DOWNLOADED);
    }

    if (route.action === "get") {
      const status = await getOfflineRecordStatus({ entity: route.entity, businessId: ctx.businessId, id: route.id });
      if (isLocalId(route.id) || status.pending) {
        return executeOffline({ ...base, action: "get", id: route.id });
      }
      const snap = await readSnapshot(ctx, route);
      if (snap) return { data: snap.data };
      const result = await executeOffline({ ...base, action: "get", id: route.id });
      return result.error ? unavailable(NOT_DOWNLOADED) : result;
    }
  }

  const snap = await readSnapshot(ctx, route);
  return snap ? { data: snap.data } : unavailable(NOT_DOWNLOADED);
}

async function serveWrite(route, ctx, api) {
  if (!(await offlineAllowed(ctx))) return unavailable(EXPIRED);

  const result = await executeOffline({
    action: route.action,
    entity: route.entity,
    businessId: ctx.businessId,
    id: route.id,
    payload: route.body,
    accessFilter: adminFilter(ctx),
  });

  if (!result.error) {
    api.dispatch(setPending(await getPendingCount(ctx.businessId)));
  }
  return result;
}

/**
 * @returns a baseQuery result, or null when the request is not served locally.
 * Never converts authentication/permission/validation/server errors into success.
 */
async function serveOffline(route, ctx, api) {
  try {
    if (route.method === "GET") return await serveRead(route, ctx);
    if (route.entity && ctx.isAdmin && supportsOfflineAction(route.entity, route.action)) {
      return await serveWrite(route, ctx, api);
    }
    return null; // online-only mutation (payments, cancel, issue/return, uploads...)
  } catch {
    return null; // IndexedDB unavailable: behave exactly like before
  }
}

const quietly = (promise) => promise.catch(() => {});

// ======================================================
// BASE QUERY WITH OFFLINE SUPPORT
// ======================================================

const baseQuery = async (args, api, extraOptions) => {
  const requestToken = api.getState()?.auth?.token ?? null;
  const url = typeof args === "string" ? args : args?.url || "";

  // ---------------- mock mode (unchanged behaviour) ----------------
  if (USE_MOCK) {
    const { mockBaseQuery } = await import("@/services/mockBaseQuery");
    const mocked = await mockBaseQuery(args, api, extraOptions);
    return handleExpiredSession(mocked, url, requestToken, api);
  }

  const ctx = resolveContext(api.getState());
  let route = ctx ? classifyRequest(args) : null;

  // ---------------- records that only exist locally (temp IDs) ----------------
  if (route?.entity && route.id && isLocalId(route.id)) {
    const mapped = await getMappedId(ctx.businessId, route.id).catch(() => null);
    if (mapped) {
      args = rewriteRequestId(args, route.id, mapped); // already synced: talk to the server with the real ID
      route = classifyRequest(args);
    } else {
      const local = await serveOffline(route, ctx, api); // still pending: serve from the device
      if (local) return local;
    }
  }

  // ---------------- 1. browser reports offline ----------------
  if (route && !isBrowserOnline()) {
    const local = await serveOffline(route, ctx, api);
    if (local) return local;
  }

  // ---------------- 2. normal online request ----------------
  const result = await realBaseQuery(args, api, extraOptions);

  if (result.data !== undefined) {
    result.data = unwrapResponse(result.data);

    if (ctx) {
      markVerified(ctx.userId);
      const method = String((typeof args === "object" && args?.method) || "GET").toUpperCase();

      if (method === "GET" && route?.snapshotable) {
        quietly(saveSnapshot(ctx, route, result.data));
        if (route.action === "list" && ctx.isAdmin) {
          const items = Array.isArray(result.data) ? result.data : result.data?.items;
          if (Array.isArray(items) && items.length) {
            quietly(mergeServerRecords(TABLE[route.entity], items, ctx.businessId));
          }
        }
      } else if (method !== "GET" && !isPublicAuthRequest(url)) {
        quietly(dropStaleSnapshots(ctx)); // server data changed: old snapshots may now be wrong
      }
    }
  }

  // revoked access must not keep being served from an old snapshot
  if (ctx && route?.snapshotable && result.error?.status === 403) {
    quietly(dropSnapshot(ctx, route));
  }

  // ---------------- 3. backend unreachable although navigator.onLine is true ----------------
  if (route && result.error && isNetworkFailure(result.error)) {
    const local = await serveOffline(route, ctx, api);
    if (local) return local;
  }

  return handleExpiredSession(result, url, requestToken, api);
};

// ---------------- 4. expired JWT (unchanged behaviour) ----------------
function handleExpiredSession(result, url, requestToken, api) {
  const isUnauthorized = result.error?.status === 401;
  const currentToken = api.getState()?.auth?.token ?? null;
  const sameSession = Boolean(requestToken) && requestToken === currentToken;

  if (isUnauthorized && !isPublicAuthRequest(url) && sameSession) {
    api.dispatch(sessionExpired());
    removeSavedSession();
    api.dispatch(baseApi.util.resetApiState());
    // NOTE: IndexedDB and the outbox are intentionally NOT cleared.
  }
  return result;
}

// ======================================================
// RTK QUERY CACHE TAGS
// ======================================================

export const TAGS = [
  "Auth", "Business", "Subscriptions", "Platform",
  "Customers", "Cars", "Bookings", "Payments", "Expenses", "Drivers", "Staff", "Inspections",
  "Reminders", "Notifications", "Documents", "Backups",
  "Settings", "Reports", "Dashboard", "Sessions",
  "Profits", "Ledger",
];

// ======================================================
// CREATE SHARED RTK QUERY API
// ======================================================

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery,
  tagTypes: TAGS,
  endpoints: () => ({}),
  keepUnusedDataFor: 60,
  refetchOnReconnect: true,
  refetchOnFocus: true,
});

// ======================================================
// CLEAN QUERY PARAMETERS (unchanged)
// ======================================================

export const clean = (params = {}) => {
  if (!params || typeof params !== "object" || Array.isArray(params)) return {};
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== "" && value !== null && value !== undefined && value !== "all"
    )
  );
};

// ======================================================
// API ERROR MESSAGE HELPER (unchanged)
// ======================================================

export const errorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (!error) return fallback;

  const data = error?.data;

  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;

  if (Array.isArray(data?.errors)) {
    const firstError = data.errors[0];
    if (typeof firstError === "string") return firstError;
    if (typeof firstError?.message === "string") return firstError.message;
  }

  if (Array.isArray(data?.details)) {
    const firstDetail = data.details[0];
    if (typeof firstDetail?.message === "string") return firstDetail.message;
  }

  if (error.status === "FETCH_ERROR") return "Unable to connect to the server. Please check your internet connection.";
  if (error.status === "TIMEOUT_ERROR") return "The server is taking too long to respond. Please try again.";
  if (error.status === "PARSING_ERROR") return "The server returned an invalid response.";

  switch (error.status) {
    case 400: return "Invalid request. Please check the provided information.";
    case 401: return "Your session has expired. Please log in again.";
    case 403: return "You do not have permission to perform this action.";
    case 404: return "The requested resource was not found.";
    case 409: return "This information already exists or conflicts with another record.";
    case 413: return "The uploaded file is too large.";
    case 422: return "Please check the information and try again.";
    case 429: return "Too many requests. Please try again later.";
    case 500: return "A server error occurred. Please try again later.";
    case 502:
    case 503:
    case 504: return "The server is temporarily unavailable. Please try again later.";
    default: return fallback;
  }
};