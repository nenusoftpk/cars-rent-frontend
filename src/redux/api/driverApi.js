/**
 * src/redux/api/driverApi.js
 *
 * Full online + offline support for drivers.
 *
 * - List / get / create / update / delete work offline (when no files)
 * - File uploads stay online-only
 * - Stats & available drivers have local fallbacks
 * - Same hooks, same argument shapes, zero page changes
 */

import { baseApi, clean } from "./baseApi";
import { mapBooking, unwrap } from "./bookingApi";
import {
  isBrowserOnline,
  isNetworkFailure,
  executeOffline,
} from "@/offline/offlineAdapter";

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------

const withId = (d) =>
  d && typeof d === "object" ? { ...d, id: d.id ?? d._id } : d;

const toList = (res, map = withId) => {
  const body = unwrap(res) || res || {};

  // Some endpoints return a plain array (e.g. available drivers)
  if (Array.isArray(body)) {
    const items = body.map((r, i) => map(r, i));
    return {
      items,
      pagination: {},
      page: 1,
      pageSize: items.length,
      total: items.length,
      totalPages: 1,
      _offline: false,
    };
  }

  const items = (body.items || []).map((r, i) => map(r, i));
  const p = body.pagination || {};

  return {
    items,
    pagination: p,
    page: body.page ?? p.page ?? 1,
    pageSize: body.pageSize ?? p.limit ?? items.length,
    total: body.total ?? p.total ?? items.length,
    totalPages: body.totalPages ?? p.totalPages ?? 1,
    summary: body.summary,
    driver: body.driver ? withId(body.driver) : undefined,
    _offline: body._offline || false,
  };
};

const DRIVER_TAGS = [
  "Drivers",
  "Bookings",
  "Expenses",
  "Payments",
  "Dashboard",
  "Reports",
  "Profits",
  "Reminders",
];

// ------------------------------------------------------------------
// Body builders – JSON when possible, FormData only when files exist
// ------------------------------------------------------------------

const REQUIRED_TEXT = ["name", "phone"];
const CLEARABLE_TEXT = [
  "email",
  "address",
  "cnic",
  "licenseNumber",
  "licenseExpiry",
];
const NUMBER_FIELDS = ["salary", "paymentRate"];
const ENUM_FIELDS = ["paymentType", "status"];
const IMAGE_FIELDS = ["photo", "cnicFront", "cnicBack", "licenseImage"];

const isRealFile = (value) =>
  typeof File !== "undefined" && value instanceof File;

const hasNewFiles = (body = {}) =>
  IMAGE_FIELDS.some((key) => isRealFile(body?.[key]));

/** Plain JSON body – works both online and offline */
function toDriverJSON(body = {}) {
  const result = {};
  const has = (v) => v !== undefined && v !== null && v !== "";

  for (const k of [...REQUIRED_TEXT, ...NUMBER_FIELDS, ...ENUM_FIELDS]) {
    if (has(body[k])) result[k] = body[k];
  }
  for (const k of CLEARABLE_TEXT) {
    if (body[k] !== undefined && body[k] !== null) {
      result[k] = body[k];
    }
  }
  return result;
}

/** Multipart FormData – online only */
function toDriverFormData(body = {}) {
  const fd = new FormData();
  const has = (v) => v !== undefined && v !== null && v !== "";

  for (const k of [...REQUIRED_TEXT, ...NUMBER_FIELDS, ...ENUM_FIELDS]) {
    if (has(body[k])) fd.append(k, String(body[k]).trim());
  }
  for (const k of CLEARABLE_TEXT) {
    if (body[k] !== undefined && body[k] !== null) {
      fd.append(k, String(body[k]).trim());
    }
  }
  for (const k of IMAGE_FIELDS) {
    if (isRealFile(body[k])) fd.append(k, body[k]);
  }
  return fd;
}

/**
 * Choose the correct body format.
 * No new images → JSON (online + offline)
 * New images   → FormData (online only)
 */
function buildDriverBody(body = {}) {
  return hasNewFiles(body) ? toDriverFormData(body) : toDriverJSON(body);
}

/** page params → params the backend reads */
export const mapDriverParams = (p = {}) =>
  clean({
    page: p.page,
    limit: p.pageSize ?? p.limit,
    search: typeof p.search === "string" ? p.search.trim() : p.search,
    status: p.status, // available | assigned | inactive | Active | Inactive
    paymentType: p.paymentType, // fixed | percentage
    sort: p.sort,
  });

// ======================================================
// LOCAL FALLBACKS
// ======================================================

async function getBusinessContext(api) {
  const state = api.getState();
  const auth = state?.auth || {};
  const user = auth.user || {};
  const businessId =
    auth.businessId ||
    user.businessId ||
    user.business?._id ||
    user.business?.id ||
    null;

  if (!businessId || user.role !== "admin") return null;

  return {
    businessId: String(businessId),
    accessFilter: (r) => String(r.businessId) === String(businessId),
  };
}

async function localDriverList(params, api) {
  const ctx = await getBusinessContext(api);
  if (!ctx) {
    return {
      data: {
        items: [],
        pagination: {},
        page: 1,
        pageSize: 0,
        total: 0,
        totalPages: 1,
        _offline: true,
      },
    };
  }

  return executeOffline({
    action: "list",
    entity: "driver",
    businessId: ctx.businessId,
    params: {
      ...params,
      limit: params.limit ?? params.pageSize ?? 50,
    },
    accessFilter: ctx.accessFilter,
    mapper: withId,
  });
}

async function localDriverStats(api) {
  const ctx = await getBusinessContext(api);
  if (!ctx) {
    return {
      data: {
        total: 0,
        available: 0,
        assigned: 0,
        inactive: 0,
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "driver",
    businessId: ctx.businessId,
    params: { limit: 3000 },
    accessFilter: ctx.accessFilter,
    mapper: withId,
  });

  if (result.error) {
    return {
      data: {
        total: 0,
        available: 0,
        assigned: 0,
        inactive: 0,
        _offline: true,
      },
    };
  }

  const items = result.data?.items || [];
  const stats = {
    total: items.length,
    available: 0,
    assigned: 0,
    inactive: 0,
    _offline: true,
  };

  for (const d of items) {
    const s = String(d.status || "").toLowerCase();
    if (s === "available" || s === "active") stats.available += 1;
    else if (s === "assigned") stats.assigned += 1;
    else if (s === "inactive" || s === "disabled") stats.inactive += 1;
  }

  return { data: stats };
}

async function localAvailableDrivers(params, api) {
  const ctx = await getBusinessContext(api);
  if (!ctx) {
    return {
      data: {
        items: [],
        pagination: {},
        page: 1,
        pageSize: 0,
        total: 0,
        totalPages: 1,
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "driver",
    businessId: ctx.businessId,
    params: {
      status: "available",
      limit: params.limit ?? params.pageSize ?? 100,
      search: params.search,
    },
    accessFilter: ctx.accessFilter,
    mapper: withId,
  });

  if (result.error) {
    return {
      data: {
        items: [],
        pagination: {},
        page: 1,
        pageSize: 0,
        total: 0,
        totalPages: 1,
        _offline: true,
      },
    };
  }

  // Extra client-side filter for “available”
  const items = (result.data?.items || []).filter((d) => {
    const s = String(d.status || "").toLowerCase();
    return s === "available" || s === "active";
  });

  return {
    data: {
      items,
      pagination: {},
      page: 1,
      pageSize: items.length,
      total: items.length,
      totalPages: 1,
      _offline: true,
    },
  };
}

// ======================================================
// DRIVER API
// ======================================================

export const driverApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // LIST DRIVERS (offline-capable)
    // --------------------------------------------------
    getDrivers: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/drivers",
            params: mapDriverParams(params),
          });

          if (!result.error) {
            return { data: toList(result.data, withId) };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localDriverList(params, api);
      },
      providesTags: ["Drivers"],
    }),

    // --------------------------------------------------
    // STATS (with offline fallback)
    // --------------------------------------------------
    getDriverStats: builder.query({
      async queryFn(_arg, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/drivers/stats",
            method: "GET",
          });

          if (!result.error) {
            return { data: unwrap(result.data) || result.data };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localDriverStats(api);
      },
      providesTags: ["Drivers", "Dashboard"],
    }),

    // --------------------------------------------------
    // AVAILABLE DRIVERS (for booking form – offline capable)
    // --------------------------------------------------
    getAvailableDrivers: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/drivers/available",
            params: clean({
              pickupDate: params.pickupDate,
              returnDate: params.returnDate,
              page: params.page,
              limit: params.pageSize ?? params.limit,
            }),
          });

          if (!result.error) {
            return { data: toList(result.data, withId) };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localAvailableDrivers(params, api);
      },
      providesTags: ["Drivers", "Bookings"],
    }),

    // --------------------------------------------------
    // SINGLE DRIVER (offline-capable)
    // --------------------------------------------------
    getDriver: builder.query({
      async queryFn(id, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/drivers/${id}`,
          });

          if (!result.error) {
            const b = unwrap(result.data);
            return { data: withId(b?.driver ?? b) };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        const ctx = await getBusinessContext(api);
        if (!ctx) return { data: null };

        const result = await executeOffline({
          action: "get",
          entity: "driver",
          businessId: ctx.businessId,
          id,
          accessFilter: ctx.accessFilter,
          mapper: withId,
        });

        if (result.error) return { data: null };
        return { data: result.data };
      },
      providesTags: (result, error, id) => [
        "Drivers",
        { type: "Drivers", id },
      ],
    }),

    // --------------------------------------------------
    // DRIVER BOOKINGS (online-only – relationship)
    // --------------------------------------------------
    getDriverBookings: builder.query({
      query: ({ id, ...params }) => ({
        url: `/drivers/${id}/bookings`,
        params: clean({
          page: params.page,
          limit: params.pageSize ?? params.limit,
          status: params.status,
        }),
      }),
      transformResponse: (res) => {
        const body = unwrap(res) || {};
        return {
          driver: body.driver ? withId(body.driver) : null,
          summary: body.summary || {},
          items: (body.items || []).map(withId),
          pagination: body.pagination || {},
          page: body.pagination?.page ?? 1,
          pageSize:
            body.pagination?.limit ?? (body.items || []).length,
          total: body.pagination?.total ?? (body.items || []).length,
          totalPages: body.pagination?.totalPages ?? 1,
        };
      },
      providesTags: ["Drivers", "Bookings"],
    }),

    // --------------------------------------------------
    // DRIVER PAYMENTS (online-only)
    // --------------------------------------------------
    getDriverPayments: builder.query({
      query: ({ id, ...params }) => ({
        url: `/drivers/${id}/payments`,
        params: clean({
          page: params.page,
          limit: params.pageSize ?? params.limit,
          from: params.from,
          to: params.to,
        }),
      }),
      transformResponse: (res) => {
        const body = unwrap(res) || {};
        return {
          driver: body.driver ? withId(body.driver) : null,
          summary: body.summary || {},
          items: (body.items || []).map(withId),
          pagination: body.pagination || {},
          page: body.pagination?.page ?? 1,
          pageSize:
            body.pagination?.limit ?? (body.items || []).length,
          total: body.pagination?.total ?? (body.items || []).length,
          totalPages: body.pagination?.totalPages ?? 1,
        };
      },
      providesTags: ["Drivers", "Payments", "Expenses"],
    }),

    // --------------------------------------------------
    // DRIVER OVERVIEW (online-only)
    // --------------------------------------------------
    getDriverOverview: builder.query({
      query: (id) => `/drivers/${id}/overview`,
      transformResponse: (res) => {
        const body = unwrap(res) || {};
        return {
          ...body,
          driver: body.driver ? withId(body.driver) : null,
          bookings: (body.bookings || []).map(withId),
          payments: (body.payments || []).map(withId),
        };
      },
      providesTags: ["Drivers", "Bookings", "Payments", "Expenses"],
    }),

    // --------------------------------------------------
    // ADD DRIVER (offline-capable when no files)
    // --------------------------------------------------
    addDriver: builder.mutation({
      query: (body) => ({
        url: "/drivers",
        method: "POST",
        body: buildDriverBody(body),
      }),
      transformResponse: (res) => {
        const b = unwrap(res);
        return withId(b?.driver ?? b);
      },
      invalidatesTags: DRIVER_TAGS,
    }),

    // --------------------------------------------------
    // UPDATE DRIVER (offline-capable when no files)
    // --------------------------------------------------
    updateDriver: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/drivers/${id}`,
        method: "PATCH",
        body: buildDriverBody(body),
      }),
      transformResponse: (res) => {
        const b = unwrap(res);
        return withId(b?.driver ?? b);
      },
      invalidatesTags: DRIVER_TAGS,
    }),

    // --------------------------------------------------
    // DELETE DRIVER (offline-capable)
    // --------------------------------------------------
    deleteDriver: builder.mutation({
      query: (id) => ({
        url: `/drivers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: DRIVER_TAGS,
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS (unchanged names)
// ======================================================

export const {
  useGetDriversQuery,
  useLazyGetDriversQuery,
  useGetDriverStatsQuery,
  useLazyGetDriverStatsQuery,
  useGetAvailableDriversQuery,
  useLazyGetAvailableDriversQuery,
  useGetDriverQuery,
  useLazyGetDriverQuery,
  useGetDriverBookingsQuery,
  useLazyGetDriverBookingsQuery,
  useGetDriverPaymentsQuery,
  useLazyGetDriverPaymentsQuery,
  useGetDriverOverviewQuery,
  useLazyGetDriverOverviewQuery,
  useAddDriverMutation,
  useUpdateDriverMutation,
  useDeleteDriverMutation,
} = driverApi;