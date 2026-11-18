
/**
 * src/redux/api/systemApi.js
 *
 * Rent-a-Car SaaS — System API
 *
 * ONLINE:
 * - Fetch reminders, notifications and search results.
 * - Cache successful GET responses in IndexedDB.
 * - Complete/reopen reminders through backend.
 *
 * OFFLINE:
 * - Read previously cached GET responses.
 * - Keep tenant/user caches isolated.
 * - Do not queue unsupported reminder mutations.
 *
 * IMPORTANT:
 * - getDashboard is owned by reportApi.js.
 * - Existing dashboard hooks are re-exported below.
 * - Existing system API hooks remain available.
 */

import { baseApi, clean } from "./baseApi";

import {
  isBrowserOnline,
  isNetworkFailure,
} from "@/offline/offlineAdapter";

import {
  getMeta,
  setMeta,
} from "@/offline/cache";

// ======================================================
// CONFIGURATION
// ======================================================

const CACHE_PREFIX = "system-cache:v1";

const SYSTEM_TAGS = {
  reminders: ["Reminders"],
  notifications: ["Notifications"],
};

// ======================================================
// HELPERS
// ======================================================

const getId = (value) => {
  if (value && typeof value === "object") {
    return value._id ?? value.id ?? null;
  }

  return value ?? null;
};

function getContext(api) {
  const auth = api.getState()?.auth || {};
  const user = auth.user || {};

  const businessId = getId(
    auth.businessId ??
    user.businessId ??
    user.business
  );

  const userId = getId(
    user._id ?? user.id
  );

  const role = auth.role ?? user.role;

  // The current local cache policy only authorizes
  // tenant administrators.
  //
  // Employee offline access requires separately verified
  // permission and dataScope filtering.
  if (
    !auth.token ||
    !businessId ||
    !userId ||
    role !== "admin"
  ) {
    return null;
  }

  return {
    businessId: String(businessId),
    userId: String(userId),
  };
}

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return value.map(stableSerialize);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    value &&
    typeof value === "object"
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [
          key,
          stableSerialize(item),
        ])
    );
  }

  return value;
}

function buildCacheKey(
  context,
  endpoint,
  params = {}
) {
  return JSON.stringify({
    namespace: CACHE_PREFIX,
    businessId: context.businessId,
    userId: context.userId,
    endpoint,
    params: stableSerialize(clean(params)),
  });
}

function offlineError(message) {
  return {
    status: "CUSTOM_ERROR",
    error: message,
    data: {
      success: false,
      message,
      _offline: true,
      _unavailable: true,
    },
  };
}

// ======================================================
// INDEXEDDB CACHE
// ======================================================

async function saveSystemCache(key, data) {
  try {
    await setMeta(key, {
      data,
      cachedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[System API] Cache write failed:",
        error
      );
    }

    return false;
  }
}

async function readSystemCache(key) {
  try {
    const cached = await getMeta(key);

    if (
      !cached ||
      !Object.prototype.hasOwnProperty.call(
        cached,
        "data"
      )
    ) {
      return null;
    }

    return cached;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[System API] Cache read failed:",
        error
      );
    }

    return null;
  }
}

function withOfflineMetadata(data, cachedAt) {
  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    return {
      ...data,
      _offline: true,
      _fromCache: true,
      _cachedAt: cachedAt,
    };
  }

  // Preserve arrays and primitive response shapes.
  return data;
}

// ======================================================
// SHARED ONLINE / OFFLINE GET
// ======================================================

async function executeSystemRead({
  url,
  params = {},
  api,
  baseQuery,
}) {
  const context = getContext(api);
  const queryParams = clean(params);

  // --------------------------------------------------
  // ONLINE REQUEST
  // --------------------------------------------------

  if (isBrowserOnline()) {
    const result = await baseQuery({
      url,
      method: "GET",
      params: queryParams,
    });

    if (!result.error) {
      if (context) {
        const key = buildCacheKey(
          context,
          url,
          queryParams
        );

        await saveSystemCache(
          key,
          result.data
        );
      }

      return {
        data: result.data,
      };
    }

    // Never conceal backend authorization, validation
    // or other HTTP errors using stale cached data.
    if (!isNetworkFailure(result.error)) {
      return {
        error: result.error,
      };
    }
  }

  // --------------------------------------------------
  // OFFLINE ACCESS VALIDATION
  // --------------------------------------------------

  if (!context) {
    return {
      error: offlineError(
        "Offline system data is unavailable for this account."
      ),
    };
  }

  // --------------------------------------------------
  // INDEXEDDB FALLBACK
  // --------------------------------------------------

  const key = buildCacheKey(
    context,
    url,
    queryParams
  );

  const cached = await readSystemCache(key);

  if (cached) {
    return {
      data: withOfflineMetadata(
        cached.data,
        cached.cachedAt
      ),
    };
  }

  return {
    error: offlineError(
      "This information is not cached yet. Connect to the internet and load it first."
    ),
  };
}

// ======================================================
// ONLINE-ONLY REMINDER MUTATIONS
// ======================================================

async function executeReminderMutation({
  id,
  action,
  baseQuery,
}) {
  if (
    id === undefined ||
    id === null ||
    String(id).trim() === ""
  ) {
    return {
      error: offlineError(
        "A valid reminder ID is required."
      ),
    };
  }

  if (!isBrowserOnline()) {
    return {
      error: offlineError(
        "Internet connection is required to change reminder status."
      ),
    };
  }

  // Reminder mutations are deliberately not written
  // to the current outbox:
  //
  // - outbox.js has no reminder entity.
  // - syncEngine.js has no reminder replay route.
  //
  // This avoids reporting an unsynchronized action
  // as successfully completed.

  return baseQuery({
    url: `/dashboard/reminders/${encodeURIComponent(
      String(id)
    )}/${action}`,
    method: "PATCH",
  });
}

// ======================================================
// SYSTEM API ENDPOINTS
// ======================================================

export const systemApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ==================================================
    // GET REMINDERS
    // GET /dashboard/reminders
    // ==================================================

    getReminders: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeSystemRead({
          url: "/dashboard/reminders",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: SYSTEM_TAGS.reminders,
    }),

    // ==================================================
    // COMPLETE REMINDER
    // PATCH /dashboard/reminders/:id/complete
    // ==================================================

    completeReminder: builder.mutation({
      async queryFn(
        id,
        _api,
        _extraOptions,
        baseQuery
      ) {
        return executeReminderMutation({
          id,
          action: "complete",
          baseQuery,
        });
      },

      invalidatesTags: [
        "Reminders",
        "Notifications",
      ],
    }),

    // ==================================================
    // REOPEN REMINDER
    // PATCH /dashboard/reminders/:id/reopen
    // ==================================================

    reopenReminder: builder.mutation({
      async queryFn(
        id,
        _api,
        _extraOptions,
        baseQuery
      ) {
        return executeReminderMutation({
          id,
          action: "reopen",
          baseQuery,
        });
      },

      invalidatesTags: [
        "Reminders",
        "Notifications",
      ],
    }),

    // ==================================================
    // GET NOTIFICATIONS
    // GET /dashboard/notifications
    // ==================================================

    getNotifications: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeSystemRead({
          url: "/dashboard/notifications",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: SYSTEM_TAGS.notifications,
    }),

    // ==================================================
    // GLOBAL SEARCH
    // GET /dashboard/search?q=...
    // ==================================================

    searchAll: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        const queryParams =
          typeof params === "string"
            ? { q: params }
            : params ?? {};

        return executeSystemRead({
          url: "/dashboard/search",
          params: queryParams,
          api,
          baseQuery,
        });
      },
    }),

  }),

  // Do not overwrite endpoints owned by reportApi.js.
  overrideExisting: false,
});

// ======================================================
// EXPORT SYSTEM HOOKS
// ======================================================

export const {
  useGetRemindersQuery,
  useLazyGetRemindersQuery,

  useCompleteReminderMutation,
  useReopenReminderMutation,

  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,

  useSearchAllQuery,
  useLazySearchAllQuery,
} = systemApi;

// ======================================================
// PRESERVE EXISTING DASHBOARD HOOK IMPORTS
// ======================================================

// getDashboard is implemented in reportApi.js,
// where the existing IndexedDB dashboard cache lives.
//
// This keeps existing imports from "./systemApi"
// working without registering a duplicate endpoint.

export {
  useGetDashboardQuery,
  useLazyGetDashboardQuery,
} from "./reportApi";
