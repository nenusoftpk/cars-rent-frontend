
/**
 * src/redux/api/platformApi.js
 *
 * Super Admin Platform API
 *
 * ONLINE:
 * - Fetch businesses and subscriptions from backend.
 * - Cache successful GET responses in IndexedDB.
 * - Execute administrative mutations on backend only.
 *
 * OFFLINE:
 * - Read previously cached platform data.
 * - Never queue administrative mutations.
 * - Never invent subscription or business information.
 *
 * SECURITY:
 * - Only authenticated Super Admins can access cache.
 * - Cache separated by authenticated user and query.
 * - Backend 401/403 errors are never bypassed.
 *
 * COMPATIBILITY:
 * - All 6 endpoints preserved.
 * - All existing hooks and arguments preserved.
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

const PLATFORM_TAGS = [
  "Platform",
  "Business",
  "Subscriptions",
  "Settings",
  "Auth",
];

const CACHE_PREFIX = "platform-cache:v1";

// ======================================================
// HELPERS
// ======================================================

const getId = (value) => {
  if (value && typeof value === "object") {
    return value._id ?? value.id ?? null;
  }

  return value ?? null;
};

const offlineError = (message) => ({
  status: "CUSTOM_ERROR",
  error: message,
  data: {
    success: false,
    message,
    _offline: true,
    _unavailable: true,
  },
});

// ======================================================
// SUPER ADMIN CONTEXT
// ======================================================

function getPlatformContext(api) {
  const auth = api.getState()?.auth || {};
  const user = auth.user || {};

  const userId = getId(
    user._id ?? user.id
  );

  const role = auth.role || user.role;

  if (
    !auth.token ||
    !userId ||
    role !== "super-admin"
  ) {
    return null;
  }

  return {
    userId: String(userId),
    role,
  };
}

// ======================================================
// CACHE KEY
// ======================================================

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return value.map(stableSerialize);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
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

function buildCacheKey(context, url, params = {}) {
  return JSON.stringify({
    namespace: CACHE_PREFIX,
    userId: context.userId,
    role: context.role,
    url,
    params: stableSerialize(clean(params)),
  });
}

// ======================================================
// CACHE HELPERS
// ======================================================

async function savePlatformCache(key, data) {
  try {
    await setMeta(key, {
      data,
      cachedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Platform API] Cache write failed:",
        error
      );
    }
  }
}

async function readPlatformCache(key) {
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
        "[Platform API] Cache read failed:",
        error
      );
    }

    return null;
  }
}

// ======================================================
// SHARED PLATFORM READ
// ======================================================

async function executePlatformRead({
  url,
  params = {},
  api,
  baseQuery,
}) {
  const context = getPlatformContext(api);
  const cleanedParams = clean(params);

  // --------------------------------------------------
  // 1. ONLINE
  // --------------------------------------------------

  if (isBrowserOnline()) {
    const result = await baseQuery({
      url,
      method: "GET",
      params: cleanedParams,
    });

    if (!result.error) {
      if (
        context &&
        result.data !== undefined &&
        result.data !== null
      ) {
        const key = buildCacheKey(
          context,
          url,
          cleanedParams
        );

        await savePlatformCache(
          key,
          result.data
        );
      }

      return { data: result.data };
    }

    // Do not bypass backend authorization errors.
    if (!isNetworkFailure(result.error)) {
      return { error: result.error };
    }
  }

  // --------------------------------------------------
  // 2. OFFLINE CACHE
  // --------------------------------------------------

  if (!context) {
    return {
      error: offlineError(
        "Platform data is unavailable offline for this account."
      ),
    };
  }

  const key = buildCacheKey(
    context,
    url,
    cleanedParams
  );

  const cached = await readPlatformCache(key);

  if (cached) {
    const data = cached.data;

    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data)
    ) {
      return {
        data: {
          ...data,
          _offline: true,
          _fromCache: true,
          _cachedAt: cached.cachedAt,
        },
      };
    }

    return { data };
  }

  return {
    error: offlineError(
      "This platform information is not available offline yet. Connect to the internet to load it."
    ),
  };
}

// ======================================================
// ONLINE-ONLY ADMINISTRATIVE MUTATIONS
// ======================================================

/**
 * Never queue these operations in IndexedDB.
 *
 * Subscription and business status changes must
 * succeed on the server before being considered saved.
 */
async function executePlatformMutation({
  url,
  method = "PATCH",
  body,
  api,
  baseQuery,
}) {
  if (!isBrowserOnline()) {
    return {
      error: offlineError(
        "Internet connection is required to change platform settings."
      ),
    };
  }

  const result = await baseQuery({
    url,
    method,
    body,
  });

  return result;
}

// ======================================================
// PLATFORM API
// ======================================================

export const platformApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ==================================================
    // LIST BUSINESSES
    // ==================================================

    listPlatformBusinesses: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executePlatformRead({
          url: "/platform/businesses",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: [
        "Platform",
        "Business",
      ],
    }),

    // ==================================================
    // CHANGE BUSINESS STATUS
    // ==================================================

    setBusinessStatus: builder.mutation({
      async queryFn(
        { id, ...body },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executePlatformMutation({
          url: `/platform/businesses/${id}/status`,
          method: "PATCH",
          body,
          api,
          baseQuery,
        });
      },

      invalidatesTags: PLATFORM_TAGS,
    }),

    // ==================================================
    // LIST SUBSCRIPTIONS
    // ==================================================

    listPlatformSubscriptions: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executePlatformRead({
          url: "/platform/subscriptions",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: [
        "Platform",
        "Subscriptions",
      ],
    }),

    // ==================================================
    // SINGLE BUSINESS SUBSCRIPTION
    // ==================================================

    getPlatformSubscription: builder.query({
      async queryFn(
        businessId,
        api,
        _extraOptions,
        baseQuery
      ) {
        return executePlatformRead({
          url: `/platform/subscriptions/${businessId}`,
          api,
          baseQuery,
        });
      },

      providesTags: (result, error, businessId) => [
        "Platform",
        "Subscriptions",
        {
          type: "Subscriptions",
          id: businessId,
        },
      ],
    }),

    // ==================================================
    // UPDATE PLATFORM SUBSCRIPTION
    // ==================================================

    setPlatformSubscription: builder.mutation({
      async queryFn(
        { businessId, ...body },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executePlatformMutation({
          url: `/platform/subscriptions/${businessId}`,
          method: "PATCH",
          body,
          api,
          baseQuery,
        });
      },

      invalidatesTags: PLATFORM_TAGS,
    }),

    // ==================================================
    // UPDATE BUSINESS SUBSCRIPTION
    // ==================================================

    setBusinessSubscription: builder.mutation({
      async queryFn(
        { businessId, ...body },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executePlatformMutation({
          url: `/platform/businesses/${businessId}/subscription`,
          method: "PATCH",
          body,
          api,
          baseQuery,
        });
      },

      invalidatesTags: PLATFORM_TAGS,
    }),

  }),

  overrideExisting: false,
});

// ======================================================
// EXPORT EXISTING HOOKS
// ======================================================

export const {
  useListPlatformBusinessesQuery,
  useLazyListPlatformBusinessesQuery,

  useSetBusinessStatusMutation,

  useListPlatformSubscriptionsQuery,
  useLazyListPlatformSubscriptionsQuery,

  useGetPlatformSubscriptionQuery,
  useLazyGetPlatformSubscriptionQuery,

  useSetPlatformSubscriptionMutation,
  useSetBusinessSubscriptionMutation,
} = platformApi;
