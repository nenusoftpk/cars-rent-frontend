
/**
 * src/redux/api/profitApi.js
 *
 * Business and car profit reports.
 *
 * ONLINE:
 * - Fetch authoritative reports from backend.
 * - Cache successful responses in IndexedDB.
 *
 * OFFLINE:
 * - Return the last cached report.
 * - Never calculate financial figures from partial data.
 * - Never fabricate zero profits.
 *
 * SECURITY:
 * - Cache is scoped to business and authenticated user.
 * - Missing authentication context cannot access cache.
 * - Backend authorization errors are never bypassed.
 *
 * COMPATIBILITY:
 * - Same endpoints, arguments and exported hooks.
 * - No page changes required for cached responses.
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

const CACHE_PREFIX = "profit-report:v1";

const PROFIT_TAGS = [
  "Profits",
  "Reports",
  "Payments",
  "Expenses",
  "Bookings",
];

// ======================================================
// HELPERS
// ======================================================

const getId = (value) => {
  if (value && typeof value === "object") {
    return value._id ?? value.id ?? null;
  }

  return value ?? null;
};

const validId = (value) =>
  typeof value === "string" &&
  value.trim().length > 0;

const offlineError = (message) => ({
  status: "CUSTOM_ERROR",
  data: {
    success: false,
    message,
    _offline: true,
    _unavailable: true,
  },
  error: message,
});

/**
 * Obtain the authenticated user's cache scope.
 *
 * Do not share cached financial information between
 * different users of the same business.
 *
 * Financial cache access is restricted to tenant admins.
 * Employee access needs a verified permission policy.
 */
function getProfitContext(api) {
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

  if (
    !auth.token ||
    !businessId ||
    !userId ||
    user.role !== "admin"
  ) {
    return null;
  }

  const business = String(businessId);
  const account = String(userId);

  if (!validId(business) || !validId(account)) {
    return null;
  }

  return {
    businessId: business,
    userId: account,
  };
}

/**
 * Stable serialization ensures that equivalent
 * query parameters use the same cache key.
 */
function stableSerialize(value) {
  if (Array.isArray(value)) {
    return value.map(stableSerialize);
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

/**
 * Cache identity includes:
 * - Business
 * - User
 * - Report type
 * - Car ID, when applicable
 * - All query parameters
 */
function buildCacheKey(
  context,
  reportType,
  carId,
  params
) {
  return JSON.stringify({
    namespace: CACHE_PREFIX,
    businessId: context.businessId,
    userId: context.userId,
    reportType,
    carId: carId ? String(carId) : null,
    params: stableSerialize(clean(params)),
  });
}

/**
 * The response is already unwrapped by baseApi.
 *
 * Preserve the exact backend report structure
 * so existing page components continue working.
 */
function normalizeProfitResponse(response) {
  if (
    response &&
    typeof response === "object"
  ) {
    return response;
  }

  return response;
}

// ======================================================
// INDEXEDDB CACHE
// ======================================================

async function saveProfitCache(key, data) {
  try {
    await setMeta(key, {
      data,
      cachedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Profit API] Unable to cache report:",
        error
      );
    }

    return false;
  }
}

async function readProfitCache(key) {
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

    if (
      cached.data === null ||
      cached.data === undefined
    ) {
      return null;
    }

    return cached;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Profit API] Unable to read cache:",
        error
      );
    }

    return null;
  }
}

// ======================================================
// SHARED PROFIT REQUEST
// ======================================================

/**
 * All three profit endpoints use this function.
 *
 * 1. Attempt backend request when online.
 * 2. Cache successful authoritative response.
 * 3. Fall back to cached data on network failure.
 * 4. Return an explicit error when no cache exists.
 *
 * HTTP errors are returned unchanged.
 */
async function executeProfitQuery({
  url,
  reportType,
  carId = null,
  params = {},
  api,
  baseQuery,
}) {
  const context = getProfitContext(api);

  const cleanedParams = clean(params);

  // --------------------------------------------------
  // 1. ONLINE REQUEST
  // --------------------------------------------------

  if (isBrowserOnline()) {
    const result = await baseQuery({
      url,
      method: "GET",
      params: cleanedParams,
    });

    if (!result.error) {
      const data = normalizeProfitResponse(
        result.data
      );

      // Cache only when we have a verified user scope.
      if (
        context &&
        data !== undefined &&
        data !== null
      ) {
        const cacheKey = buildCacheKey(
          context,
          reportType,
          carId,
          cleanedParams
        );

        await saveProfitCache(cacheKey, data);
      }

      return { data };
    }

    // Never replace a real backend error with
    // previously cached financial information.
    if (!isNetworkFailure(result.error)) {
      return { error: result.error };
    }
  }

  // --------------------------------------------------
  // 2. OFFLINE / NETWORK FAILURE
  // --------------------------------------------------

  if (!context) {
    return {
      error: offlineError(
        "Offline profit reports are unavailable for this account. Connect to the internet."
      ),
    };
  }

  const cacheKey = buildCacheKey(
    context,
    reportType,
    carId,
    cleanedParams
  );

  const cached = await readProfitCache(cacheKey);

  if (cached) {
    const data = cached.data;

    // Preserve the original backend response shape.
    // Add offline metadata without modifying totals.
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

  // --------------------------------------------------
  // 3. NO CACHED REPORT
  // --------------------------------------------------

  return {
    error: offlineError(
      "This profit report is not available offline yet. Connect to the internet to load it."
    ),
  };
}

// ======================================================
// PROFIT API
// ======================================================

export const profitApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ==================================================
    // BUSINESS PROFIT
    // ==================================================

    getBusinessProfit: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeProfitQuery({
          url: "/profits/business",
          reportType: "business",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: PROFIT_TAGS,
    }),

    // ==================================================
    // ALL CARS PROFIT
    // ==================================================

    getAllCarsProfit: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeProfitQuery({
          url: "/profits/cars",
          reportType: "all-cars",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: [
        ...PROFIT_TAGS,
        "Cars",
      ],
    }),

    // ==================================================
    // SINGLE CAR PROFIT
    // ==================================================

    getCarProfit: builder.query({
      async queryFn(
        { carId, ...params },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeProfitQuery({
          url: `/profits/cars/${carId}`,
          reportType: "single-car",
          carId,
          params,
          api,
          baseQuery,
        });
      },

      providesTags: (result, error, { carId }) => [
        ...PROFIT_TAGS,
        { type: "Cars", id: carId },
      ],
    }),

  }),

  overrideExisting: false,
});

// ======================================================
// EXPORT HOOKS - UNCHANGED
// ======================================================

export const {
  useGetBusinessProfitQuery,
  useLazyGetBusinessProfitQuery,

  useGetAllCarsProfitQuery,
  useLazyGetAllCarsProfitQuery,

  useGetCarProfitQuery,
  useLazyGetCarProfitQuery,
} = profitApi;
