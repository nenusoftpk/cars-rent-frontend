
/**
 * src/redux/api/reportApi.js
 *
 * Online + Offline reports for Rent-a-Car SaaS.
 *
 * ONLINE:
 * - Fetch real reports from the backend.
 * - Preserve the exact backend response structure.
 * - Cache successful responses in IndexedDB.
 *
 * OFFLINE:
 * - Return the last successfully cached report.
 * - Never calculate fake reports from incomplete data.
 * - Never invent financial totals or balances.
 * - Return an unavailable error if no cache exists.
 *
 * SECURITY:
 * - Cache is isolated by business and authenticated user.
 * - Only tenant admins can access offline reports.
 * - Backend authorization errors are never bypassed.
 *
 * COMPATIBILITY:
 * - All existing endpoints preserved.
 * - All existing hooks preserved.
 * - No page changes required for cached reports.
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

const CACHE_PREFIX = "report-cache:v1";

const REPORT_TYPES = [
  "income-expense",
  "bookings",
  "payments",
  "expenses",
  "customers",
  "cars-status",
  "drivers",
];

const REPORT_TAGS = [
  "Reports",
  "Bookings",
  "Payments",
  "Expenses",
  "Customers",
  "Cars",
  "Drivers",
  "Profits",
  "Dashboard",
];

// ======================================================
// BASIC HELPERS
// ======================================================

const getId = (value) => {
  if (value && typeof value === "object") {
    return value._id ?? value.id ?? null;
  }

  return value ?? null;
};

const isValidId = (value) =>
  typeof value === "string" &&
  value.trim().length > 0;

const createError = (
  message,
  status = "CUSTOM_ERROR"
) => ({
  status,
  error: message,
  data: {
    success: false,
    message,
  },
});

const createOfflineError = (message) => ({
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
// AUTHENTICATED CACHE CONTEXT
// ======================================================

/**
 * Financial reports may contain sensitive information.
 *
 * Never share report caches between different users
 * of the same business.
 *
 * For now, offline report access is restricted to
 * tenant admins.
 *
 * Employee offline access requires a verified
 * permission and data-scope policy.
 */
function getReportContext(api) {
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

  if (
    !isValidId(business) ||
    !isValidId(account)
  ) {
    return null;
  }

  return {
    businessId: business,
    userId: account,
  };
}

// ======================================================
// REPORT NAME VALIDATION
// ======================================================

function normalizeReportName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

function validateReportName(name) {
  const reportName = normalizeReportName(name);

  if (!REPORT_TYPES.includes(reportName)) {
    return {
      error: createError(
        `Invalid report type: ${name}. Allowed: ${REPORT_TYPES.join(", ")}`
      ),
    };
  }

  return {
    name: reportName,
  };
}

// ======================================================
// STABLE CACHE KEY
// ======================================================

/**
 * Sort object keys recursively.
 *
 * Two requests with equivalent query parameters
 * must generate the same cache key.
 */
function stableSerialize(value) {
  if (Array.isArray(value)) {
    return value.map(stableSerialize);
  }

  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date)
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

  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
}

/**
 * Every report cache is separated by:
 *
 * - Business ID
 * - User ID
 * - Report endpoint
 * - Search/filter/date parameters
 * - Pagination parameters
 */
function buildReportCacheKey(
  context,
  reportPath,
  params = {}
) {
  return JSON.stringify({
    namespace: CACHE_PREFIX,
    businessId: context.businessId,
    userId: context.userId,
    path: reportPath,
    params: stableSerialize(clean(params)),
  });
}

// ======================================================
// INDEXEDDB CACHE HELPERS
// ======================================================

async function saveReportCache(key, data) {
  try {
    await setMeta(key, {
      data,
      cachedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Report API] Unable to cache report:",
        error
      );
    }

    return false;
  }
}

async function readReportCache(key) {
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
        "[Report API] Unable to read cache:",
        error
      );
    }

    return null;
  }
}

// ======================================================
// OFFLINE RESPONSE
// ======================================================

/**
 * Add cache metadata without changing report figures.
 *
 * Existing pages receive their usual response fields.
 *
 * _offline   = response came from IndexedDB
 * _fromCache = cached backend report
 * _cachedAt  = time of last successful fetch
 */
function cachedReportResponse(cached) {
  const data = cached.data;

  if (
    data &&
    typeof data === "object" &&
    !Array.isArray(data)
  ) {
    return {
      ...data,
      _offline: true,
      _fromCache: true,
      _cachedAt: cached.cachedAt ?? null,
    };
  }

  // Preserve arrays and primitive response types.
  return data;
}

// ======================================================
// SHARED REPORT QUERY EXECUTOR
// ======================================================

/**
 * Shared online/offline behavior for all reports.
 *
 * Online:
 *   Backend -> RTK Query -> IndexedDB cache
 *
 * Offline:
 *   IndexedDB cache -> RTK Query -> Existing page
 *
 * Network failure:
 *   Try cached backend response.
 *
 * No cache:
 *   Return a clear unavailable error.
 */
async function executeReportQuery({
  url,
  params = {},
  api,
  baseQuery,
}) {
  const cleanedParams = clean(params);

  const context = getReportContext(api);

  // ==================================================
  // 1. ONLINE REQUEST
  // ==================================================

  if (isBrowserOnline()) {
    const result = await baseQuery({
      url,
      method: "GET",
      params: cleanedParams,
    });

    if (!result.error) {
      const data = result.data;

      // baseApi already unwraps successful backend
      // responses. Do not unwrap them a second time.

      if (
        context &&
        data !== null &&
        data !== undefined
      ) {
        const key = buildReportCacheKey(
          context,
          url,
          cleanedParams
        );

        await saveReportCache(key, data);
      }

      return { data };
    }

    // Real backend errors must be returned unchanged.
    // Never bypass 401/403 or validation errors
    // using a previously cached report.
    if (!isNetworkFailure(result.error)) {
      return {
        error: result.error,
      };
    }
  }

  // ==================================================
  // 2. OFFLINE / NETWORK FAILURE
  // ==================================================

  if (!context) {
    return {
      error: createOfflineError(
        "Offline reports are unavailable for this account. Connect to the internet."
      ),
    };
  }

  const key = buildReportCacheKey(
    context,
    url,
    cleanedParams
  );

  const cached = await readReportCache(key);

  if (cached) {
    return {
      data: cachedReportResponse(cached),
    };
  }

  // ==================================================
  // 3. NO CACHED REPORT
  // ==================================================

  return {
    error: createOfflineError(
      "This report is not available offline yet. Connect to the internet to load it."
    ),
  };
}

// ======================================================
// REPORT API
// ======================================================

export const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ==================================================
    // DASHBOARD
    // ==================================================

    getDashboard: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/dashboard",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: [
        "Dashboard",
        ...REPORT_TAGS,
      ],
    }),

    // ==================================================
    // UNIFIED REPORT
    // ==================================================

    getReport: builder.query({
      async queryFn(
        { name, ...params },
        api,
        _extraOptions,
        baseQuery
      ) {
        const validation = validateReportName(name);

        if (validation.error) {
          return {
            error: validation.error,
          };
        }

        return executeReportQuery({
          url: `/reports/${validation.name}`,
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

    // ==================================================
    // INCOME AND EXPENSE REPORT
    // ==================================================

    getIncomeExpenseReport: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/reports/income-expense",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

    // ==================================================
    // BOOKING REPORT
    // ==================================================

    getBookingReport: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/reports/bookings",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

    // ==================================================
    // PAYMENT REPORT
    // ==================================================

    getPaymentReport: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/reports/payments",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

    // ==================================================
    // EXPENSE REPORT
    // ==================================================

    getExpenseReport: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/reports/expenses",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

    // ==================================================
    // CUSTOMER REPORT
    // ==================================================

    getCustomerReport: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/reports/customers",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

    // ==================================================
    // CARS STATUS REPORT
    // ==================================================

    getCarsStatusReport: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/reports/cars-status",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

    // ==================================================
    // DRIVER REPORT
    // ==================================================

    getDriverReport: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeReportQuery({
          url: "/reports/drivers",
          params,
          api,
          baseQuery,
        });
      },

      providesTags: REPORT_TAGS,
    }),

  }),

  // Preserve the setting from your original file.
  overrideExisting: true,
});

// ======================================================
// EXPORT HOOKS - UNCHANGED
// ======================================================

export const {
  // Dashboard
  useGetDashboardQuery,
  useLazyGetDashboardQuery,

  // Unified
  useGetReportQuery,
  useLazyGetReportQuery,

  // Individual reports
  useGetIncomeExpenseReportQuery,
  useLazyGetIncomeExpenseReportQuery,

  useGetBookingReportQuery,
  useLazyGetBookingReportQuery,

  useGetPaymentReportQuery,
  useLazyGetPaymentReportQuery,

  useGetExpenseReportQuery,
  useLazyGetExpenseReportQuery,

  useGetCustomerReportQuery,
  useLazyGetCustomerReportQuery,

  useGetCarsStatusReportQuery,
  useLazyGetCarsStatusReportQuery,

  useGetDriverReportQuery,
  useLazyGetDriverReportQuery,
} = reportApi;
