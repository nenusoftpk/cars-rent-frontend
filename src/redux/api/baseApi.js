import {
  createApi,
  fetchBaseQuery,
} from "@reduxjs/toolkit/query/react";

import { sessionExpired } from "../slices/authSlice";

import {
  executeOffline,
  isNetworkFailure,
  isBrowserOnline,
} from "@/offline/offlineAdapter";

// ======================================================
// CONFIGURATION
// ======================================================

const USE_MOCK =
  process.env.NEXT_PUBLIC_USE_MOCK === "true";

const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const AUTH_STORAGE_KEY = "rac_auth";

// ======================================================
// REAL BACKEND QUERY
// ======================================================

const realBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,

  prepareHeaders: (headers, { getState }) => {
    const token = getState()?.auth?.token;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.delete("Authorization");
    }

    headers.set("Accept", "application/json");

    // fetchBaseQuery handles JSON and FormData.
    return headers;
  },
});

// ======================================================
// BACKEND RESPONSE UNWRAPPING
// ======================================================

const unwrapResponse = (response) => {
  if (
    response &&
    typeof response === "object" &&
    !Array.isArray(response) &&
    Object.prototype.hasOwnProperty.call(
      response,
      "data"
    ) &&
    (
      Object.prototype.hasOwnProperty.call(
        response,
        "success"
      ) ||
      Object.prototype.hasOwnProperty.call(
        response,
        "message"
      )
    )
  ) {
    return response.data;
  }

  return response;
};

// ======================================================
// PUBLIC AUTH ROUTES
// ======================================================

const PUBLIC_AUTH_ROUTES = new Set([
  "/auth/signup",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
]);

const normalizePath = (url) => {
  const raw = String(url || "").split("?")[0];

  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname
        .replace(/^\/api\/v1/, "")
        .replace(/\/+$/, "") || "/";
    }
  } catch {
    // Fall back to relative URL handling.
  }

  return raw
    .replace(/^\/api\/v1/, "")
    .replace(/\/+$/, "") || "/";
};

const isPublicAuthRequest = (url) =>
  PUBLIC_AUTH_ROUTES.has(normalizePath(url));

// ======================================================
// SESSION STORAGE
// ======================================================

const removeSavedSession = () => {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be disabled.
  }
};

// ======================================================
// OFFLINE ROUTE CONFIGURATION
// ======================================================

/**
 * Only explicitly supported endpoints can use IndexedDB.
 *
 * Do not automatically intercept:
 * - Authentication
 * - Subscription management
 * - Platform administration
 * - Payments
 * - Financial transactions
 * - File uploads
 * - Special booking actions
 *
 * Other APIs continue using the backend normally.
 */

const OFFLINE_RESOURCES = Object.freeze({
  cars: "car",
  customers: "customer",
  bookings: "booking",
});

const OFFLINE_METHODS = new Set([
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
]);

const OFFLINE_WRITES = Object.freeze({
  car: new Set(["create", "update", "delete"]),
  customer: new Set(["create", "update", "delete"]),
  booking: new Set(["create", "update"]),
});

// ======================================================
// OFFLINE REQUEST MATCHING
// ======================================================

function parseOfflineRequest(args) {
  const request =
    typeof args === "string"
      ? { url: args, method: "GET" }
      : args || {};

  const method = String(
    request.method || "GET"
  ).toUpperCase();

  if (!OFFLINE_METHODS.has(method)) {
    return null;
  }

  const rawUrl = String(request.url || "");

  const [path, queryString = ""] =
    normalizePath(rawUrl).split("?");

  const segments = path.split("/").filter(Boolean);

  if (!segments.length || segments.length > 2) {
    return null;
  }

  const entity = OFFLINE_RESOURCES[segments[0]];

  if (!entity) return null;

  const id = segments[1] || null;

  const params = {
    ...Object.fromEntries(
      new URLSearchParams(queryString)
    ),
    ...(request.params || {}),
  };

  let action = null;

  if (method === "GET") {
    action = id ? "get" : "list";
  } else if (method === "POST" && !id) {
    action = "create";
  } else if (
    (method === "PATCH" || method === "PUT") &&
    id
  ) {
    action = "update";
  } else if (method === "DELETE" && id) {
    action = "delete";
  }

  if (!action) return null;

  // Bookings cannot be deleted through the generic
  // adapter. Cancellation uses a special backend route.
  if (
    action !== "list" &&
    action !== "get" &&
    !OFFLINE_WRITES[entity]?.has(action)
  ) {
    return null;
  }

  return {
    entity,
    action,
    id,
    params,
    payload: request.body,
  };
}

// ======================================================
// AUTHENTICATED OFFLINE CONTEXT
// ======================================================

/**
 * Offline access must be restricted to authenticated
 * users and their permitted records.
 *
 * This version deliberately requires an explicit
 * permission filter. It does not use () => true,
 * because that could expose another employee's data.
 *
 * Your authSlice must provide:
 * - auth.businessId OR auth.user.businessId
 * - auth.user.role
 * - auth.user.dataScope / permissions
 *
 * For now, only admins can use offline data.
 * Employee offline access requires a verified
 * employee-specific permission filter.
 */

function getOfflineContext(api) {
  const state = api.getState();
  const auth = state?.auth || {};

  const user = auth.user || {};

  const businessId =
    auth.businessId ||
    user.businessId ||
    user.business?._id ||
    user.business?.id ||
    null;

  const token = auth.token;

  if (!token || !businessId) {
    return null;
  }

  // This is intentionally conservative.
  // Platform super-admins must not access tenant
  // data through an unrestricted local cache.
  if (user.role !== "admin") {
    return null;
  }

  return {
    businessId: String(
      businessId?._id ||
      businessId?.id ||
      businessId
    ),
    accessFilter: (record) =>
      String(record.businessId) ===
      String(
        businessId?._id ||
        businessId?.id ||
        businessId
      ),
  };
}

// ======================================================
// OFFLINE REQUEST EXECUTION
// ======================================================

async function tryOfflineRequest(args, api) {
  const route = parseOfflineRequest(args);

  if (!route) return null;

  const context = getOfflineContext(api);

  if (!context) return null;

  return executeOffline({
    ...route,
    businessId: context.businessId,
    accessFilter: context.accessFilter,
  });
}

// ======================================================
// BASE QUERY WITH OFFLINE SUPPORT
// ======================================================

const baseQuery = async (
  args,
  api,
  extraOptions
) => {
  const requestToken =
    api.getState()?.auth?.token ?? null;

  const url =
    typeof args === "string"
      ? args
      : args?.url || "";

  const offlineRoute = parseOfflineRequest(args);

  const queryFn = USE_MOCK
    ? (
        await import(
          "@/services/mockBaseQuery"
        )
      ).mockBaseQuery
    : realBaseQuery;

  // ==================================================
  // 1. OFFLINE FIRST WHEN DISCONNECTED
  // ==================================================

  if (
    !USE_MOCK &&
    !isBrowserOnline() &&
    offlineRoute
  ) {
    const offlineResult =
      await tryOfflineRequest(args, api);

    if (offlineResult) {
      return offlineResult;
    }
  }

  // ==================================================
  // 2. NORMAL ONLINE REQUEST
  // ==================================================

  const result = await queryFn(
    args,
    api,
    extraOptions
  );

  // ==================================================
  // 3. UNWRAP SUCCESSFUL RESPONSE
  // ==================================================

  if (
    result.data !== undefined &&
    !USE_MOCK
  ) {
    result.data = unwrapResponse(result.data);
  }

  // ==================================================
  // 4. NETWORK FAILURE FALLBACK
  // ==================================================

  if (
    !USE_MOCK &&
    result.error &&
    isNetworkFailure(result.error) &&
    offlineRoute
  ) {
    const offlineResult =
      await tryOfflineRequest(args, api);

    if (offlineResult) {
      return offlineResult;
    }
  }

  // ==================================================
  // 5. HANDLE EXPIRED JWT
  // ==================================================

  const isUnauthorized =
    result.error?.status === 401;

  const isPublicRequest =
    isPublicAuthRequest(url);

  const currentToken =
    api.getState()?.auth?.token ?? null;

  const sameSession =
    Boolean(requestToken) &&
    requestToken === currentToken;

  if (
    isUnauthorized &&
    !isPublicRequest &&
    sameSession
  ) {
    api.dispatch(sessionExpired());

    removeSavedSession();

    api.dispatch(
      baseApi.util.resetApiState()
    );
  }

  return result;
};

// ======================================================
// RTK QUERY CACHE TAGS
// ======================================================

export const TAGS = [
  "Auth",

  "Business",
  "Subscriptions",
  "Platform",

  "Customers",
  "Cars",
  "Bookings",
  "Payments",
  "Expenses",
  "Drivers",
  "Staff",
  "Inspections",

  "Reminders",
  "Notifications",
  "Documents",
  "Backups",

  "Settings",
  "Reports",
  "Dashboard",
  "Sessions",

  "Profits",
  "Ledger",
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
// CLEAN QUERY PARAMETERS
// ======================================================

export const clean = (params = {}) => {
  if (
    !params ||
    typeof params !== "object" ||
    Array.isArray(params)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined &&
        value !== "all"
    )
  );
};

// ======================================================
// API ERROR MESSAGE HELPER
// ======================================================

export const errorMessage = (
  error,
  fallback = "Something went wrong. Please try again."
) => {
  if (!error) return fallback;

  const data = error?.data;

  if (
    typeof data?.message === "string" &&
    data.message.trim()
  ) {
    return data.message;
  }

  if (
    typeof data?.error === "string" &&
    data.error.trim()
  ) {
    return data.error;
  }

  if (Array.isArray(data?.errors)) {
    const firstError = data.errors[0];

    if (typeof firstError === "string") {
      return firstError;
    }

    if (
      typeof firstError?.message === "string"
    ) {
      return firstError.message;
    }
  }

  if (Array.isArray(data?.details)) {
    const firstDetail = data.details[0];

    if (
      typeof firstDetail?.message === "string"
    ) {
      return firstDetail.message;
    }
  }

  if (error.status === "FETCH_ERROR") {
    return "Unable to connect to the server. Please check your internet connection.";
  }

  if (error.status === "TIMEOUT_ERROR") {
    return "The server is taking too long to respond. Please try again.";
  }

  if (error.status === "PARSING_ERROR") {
    return "The server returned an invalid response.";
  }

  switch (error.status) {
    case 400:
      return "Invalid request. Please check the provided information.";

    case 401:
      return "Your session has expired. Please log in again.";

    case 403:
      return "You do not have permission to perform this action.";

    case 404:
      return "The requested resource was not found.";

    case 409:
      return "This information already exists or conflicts with another record.";

    case 413:
      return "The uploaded file is too large.";

    case 422:
      return "Please check the information and try again.";

    case 429:
      return "Too many requests. Please try again later.";

    case 500:
      return "A server error occurred. Please try again later.";

    case 502:
    case 503:
    case 504:
      return "The server is temporarily unavailable. Please try again later.";

    default:
      return fallback;
  }
};