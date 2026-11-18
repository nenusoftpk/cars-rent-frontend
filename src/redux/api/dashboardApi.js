
/**
 * src/redux/api/dashboardApi.js
 *
 * Rent-a-Car SaaS — Dashboard API
 *
 * This file provides backward-compatible exports for
 * existing dashboard and reminder functionality.
 *
 * ENDPOINT OWNERSHIP:
 *
 * reportApi.js
 *   - getDashboard
 *
 * systemApi.js
 *   - getReminders
 *   - completeReminder
 *   - reopenReminder
 *   - getNotifications
 *   - searchAll
 *
 * This module does not inject duplicate endpoints.
 *
 * ONLINE:
 *   Uses the original backend endpoints.
 *
 * OFFLINE:
 *   Uses the IndexedDB cache implementations
 *   provided by reportApi.js and systemApi.js.
 *
 * Existing pages and components can continue
 * importing their hooks from dashboardApi.js.
 */

// ======================================================
// IMPORT SHARED RTK QUERY API
// ======================================================

import { baseApi } from "./baseApi";

// ======================================================
// IMPORT DASHBOARD HOOKS
// ======================================================

import {
  useGetDashboardQuery,
  useLazyGetDashboardQuery,
} from "./reportApi";

// ======================================================
// IMPORT SYSTEM HOOKS
// ======================================================

import {
  useGetRemindersQuery,
  useLazyGetRemindersQuery,

  useCompleteReminderMutation,
  useReopenReminderMutation,

  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,

  useSearchAllQuery,
  useLazySearchAllQuery,
} from "./systemApi";

// ======================================================
// DASHBOARD API
// ======================================================

/**
 * All endpoints are already injected into baseApi
 * by their respective owning modules.
 *
 * Do not inject them again here.
 *
 * This avoids duplicate endpoint definitions and
 * ensures the offline-aware implementations remain
 * active throughout the application.
 */

export const dashboardApi = baseApi;

// ======================================================
// DASHBOARD STATS HOOKS
// ======================================================

export {
  useGetDashboardQuery,
  useLazyGetDashboardQuery,
};

// ======================================================
// REMINDER HOOKS
// ======================================================

export {
  useGetRemindersQuery,
  useLazyGetRemindersQuery,

  useCompleteReminderMutation,
  useReopenReminderMutation,
};

// ======================================================
// NOTIFICATION HOOKS
// ======================================================

export {
  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,
};

// ======================================================
// GLOBAL SEARCH HOOKS
// ======================================================

/**
 * The original dashboardApi.js used:
 *
 *   useGlobalSearchQuery
 *   useLazyGlobalSearchQuery
 *
 * systemApi.js uses:
 *
 *   useSearchAllQuery
 *   useLazySearchAllQuery
 *
 * Re-export the same underlying RTK Query hooks
 * using their original names.
 *
 * This preserves existing imports without
 * creating another search endpoint.
 */

export {
  useSearchAllQuery as useGlobalSearchQuery,
  useLazySearchAllQuery as useLazyGlobalSearchQuery,
};

// ======================================================
// OPTIONAL SYSTEM SEARCH EXPORTS
// ======================================================

/**
 * These additional exports allow components to use
 * either naming convention.
 */

export {
  useSearchAllQuery,
  useLazySearchAllQuery,
};

// ======================================================
// DEFAULT EXPORT
// ======================================================

export default dashboardApi;
