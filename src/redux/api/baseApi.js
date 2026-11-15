
import {
  createApi,
  fetchBaseQuery,
} from "@reduxjs/toolkit/query/react";

import { sessionExpired } from "../slices/authSlice";

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

  // Backend uses JWT Bearer authentication.
  prepareHeaders: (headers, { getState }) => {
    const token = getState()?.auth?.token;

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else {
      headers.delete("Authorization");
    }

    headers.set("Accept", "application/json");

    // Do not manually set Content-Type.
    // fetchBaseQuery handles JSON and FormData.
    return headers;
  },
});

// ======================================================
// BACKEND RESPONSE UNWRAPPING
// ======================================================

// Backend response example:
//
// {
//   success: true,
//   message: "Logged in successfully.",
//   data: {
//     user: {},
//     token: "jwt-token"
//   }
// }
//
// RTK Query returns only the inner data object.
//
// Error responses remain unchanged so the frontend
// can display backend validation messages.

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

// A failed public authentication request should not
// automatically expire an existing authenticated session.

const PUBLIC_AUTH_ROUTES = new Set([
  "/auth/signup",
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
]);

const isPublicAuthRequest = (url) => {
  const path = String(url || "")
    .split("?")[0]
    .replace(/\/+$/, "");

  return PUBLIC_AUTH_ROUTES.has(path);
};

// ======================================================
// SESSION STORAGE
// ======================================================

const removeSavedSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be disabled by browser settings.
  }
};

// ======================================================
// BASE QUERY WITH SESSION HANDLING
// ======================================================

const baseQuery = async (
  args,
  api,
  extraOptions
) => {
  // Capture the token used when the request begins.
  // This prevents an old 401 response from clearing
  // a different, newly authenticated session.

  const requestToken =
    api.getState()?.auth?.token ?? null;

  const url =
    typeof args === "string"
      ? args
      : args?.url || "";

  // Use mock API only when explicitly enabled.
  const queryFn = USE_MOCK
    ? (
        await import(
          "@/services/mockBaseQuery"
        )
      ).mockBaseQuery
    : realBaseQuery;

  const result = await queryFn(
    args,
    api,
    extraOptions
  );

  // ==================================================
  // UNWRAP SUCCESSFUL BACKEND RESPONSES
  // ==================================================

  if (
    result.data !== undefined &&
    !USE_MOCK
  ) {
    result.data = unwrapResponse(result.data);
  }

  // ==================================================
  // HANDLE EXPIRED JWT
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
    // Clear Redux authentication state.
    api.dispatch(sessionExpired());

    // Clear browser-persisted JWT.
    removeSavedSession();

    // Remove cached data belonging to this session.
    //
    // Use the RTK Query reset action directly.
    // This is safe because baseApi is initialized
    // before the first network request executes.
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

  // Keep unused query data for 60 seconds.
  keepUnusedDataFor: 60,

  // Refetch stale data when the browser reconnects.
  refetchOnReconnect: true,

  // Refetch when the user returns to the browser tab.
  refetchOnFocus: true,
});

// ======================================================
// CLEAN QUERY PARAMETERS
// ======================================================

// Removes empty values before sending query parameters.
//
// Example:
//
// clean({
//   search: "Toyota",
//   status: "all",
//   page: 1,
//   limit: 10,
//   from: "",
// });
//
// Result:
//
// {
//   search: "Toyota",
//   page: 1,
//   limit: 10,
// }

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
      ([, value]) => {
        return (
          value !== "" &&
          value !== null &&
          value !== undefined &&
          value !== "all"
        );
      }
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
  if (!error) {
    return fallback;
  }

  const data = error?.data;

  // ==================================================
  // BACKEND ERROR MESSAGE
  // ==================================================

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

  // ==================================================
  // JOI VALIDATION ERRORS
  // ==================================================

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

  // ==================================================
  // NETWORK ERROR
  // ==================================================

  if (error.status === "FETCH_ERROR") {
    return "Unable to connect to the server. Please check your internet connection.";
  }

  if (error.status === "TIMEOUT_ERROR") {
    return "The server is taking too long to respond. Please try again.";
  }

  if (error.status === "PARSING_ERROR") {
    return "The server returned an invalid response.";
  }

  // ==================================================
  // HTTP STATUS ERRORS
  // ==================================================

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
