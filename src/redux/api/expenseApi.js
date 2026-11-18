/**
 * src/redux/api/expenseApi.js
 *
 * Full online + offline support for expenses.
 *
 * - List / get / create / update / delete work offline
 * - Stats have a local approximation
 * - Driver booking balance stays online-only
 * - Same hooks, same argument shapes, zero page changes
 */

import { baseApi, clean } from "./baseApi";
import { unwrap } from "./bookingApi";
import {
  isBrowserOnline,
  isNetworkFailure,
  executeOffline,
} from "@/offline/offlineAdapter";

// ======================================================
// HELPERS
// ======================================================

const withId = (d) =>
  d && typeof d === "object" ? { ...d, id: d.id ?? d._id } : d;

const toList = (res, map = withId) => {
  const body = unwrap(res) || res || {};
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
    _offline: body._offline || false,
  };
};

const EXPENSE_TAGS = [
  "Expenses",
  "Reports",
  "Dashboard",
  "Cars",
  "Drivers",
  "Bookings",
  "Payments",
  "Profits",
  "Ledger",
  "Reminders",
];

/**
 * ONE place that decides which query-string names the backend gets.
 * Names follow the Expense model: category, paymentMethod, carId, driverId,
 * bookingId, from/to (expenseDate).
 */
export const mapExpenseParams = (p = {}) =>
  clean({
    page: p.page,
    limit: p.pageSize ?? p.limit,
    search: typeof p.search === "string" ? p.search.trim() : p.search,
    from: p.from,
    to: p.to,
    carId: p.carId,
    driverId: p.driverId,
    bookingId: p.bookingId,
    category: p.category,
    paymentMethod: p.paymentMethod,
    sort: p.sort, // e.g. expenseDate:desc | amount:desc
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

async function localExpenseList(params, api) {
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
    entity: "expense",
    businessId: ctx.businessId,
    params: {
      ...params,
      limit: params.limit ?? params.pageSize ?? 50,
    },
    accessFilter: ctx.accessFilter,
    mapper: withId,
  });
}

async function localExpenseStats(params, api) {
  const ctx = await getBusinessContext(api);
  if (!ctx) {
    return {
      data: {
        total: 0,
        count: 0,
        byCategory: {},
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "expense",
    businessId: ctx.businessId,
    params: {
      from: params.from,
      to: params.to,
      carId: params.carId,
      limit: 3000,
    },
    accessFilter: ctx.accessFilter,
    mapper: withId,
  });

  if (result.error) {
    return {
      data: {
        total: 0,
        count: 0,
        byCategory: {},
        _offline: true,
      },
    };
  }

  const items = result.data?.items || [];
  let total = 0;
  const byCategory = {};

  for (const e of items) {
    const amount = Number(e.amount) || 0;
    total += amount;
    const cat = e.category || "Other";
    byCategory[cat] = (byCategory[cat] || 0) + amount;
  }

  return {
    data: {
      total,
      count: items.length,
      byCategory,
      _offline: true,
    },
  };
}

// ======================================================
// EXPENSE API
// ======================================================

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // LIST EXPENSES (offline-capable)
    // --------------------------------------------------
    getExpenses: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/expenses",
            method: "GET",
            params: mapExpenseParams(params),
          });

          if (!result.error) {
            return { data: toList(result.data, withId) };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localExpenseList(params, api);
      },
      providesTags: ["Expenses"],
    }),

    // --------------------------------------------------
    // EXPENSE STATS (with offline fallback)
    // --------------------------------------------------
    getExpenseStats: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/expenses/stats",
            method: "GET",
            params: clean({
              from: params.from,
              to: params.to,
              carId: params.carId,
            }),
          });

          if (!result.error) {
            return { data: unwrap(result.data) || result.data };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localExpenseStats(params, api);
      },
      providesTags: ["Expenses", "Dashboard"],
    }),

    // --------------------------------------------------
    // SINGLE EXPENSE (offline-capable)
    // --------------------------------------------------
    getExpense: builder.query({
      async queryFn(id, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/expenses/${id}`,
            method: "GET",
          });

          if (!result.error) {
            const b = unwrap(result.data);
            return { data: withId(b?.expense ?? b) };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        const ctx = await getBusinessContext(api);
        if (!ctx) return { data: null };

        const result = await executeOffline({
          action: "get",
          entity: "expense",
          businessId: ctx.businessId,
          id,
          accessFilter: ctx.accessFilter,
          mapper: withId,
        });

        if (result.error) return { data: null };
        return { data: result.data };
      },
      providesTags: (result, error, id) => [
        "Expenses",
        { type: "Expenses", id },
      ],
    }),

    // --------------------------------------------------
    // DRIVER BOOKING BALANCE (online-only)
    // --------------------------------------------------
    getDriverBookingBalance: builder.query({
      query: (bookingId) => ({
        url: `/expenses/driver-balance/${bookingId}`,
        method: "GET",
      }),
      transformResponse: (res) => unwrap(res),
      providesTags: ["Expenses", "Drivers", "Bookings"],
    }),

    // --------------------------------------------------
    // ADD EXPENSE (offline-capable – pure JSON)
    // --------------------------------------------------
    addExpense: builder.mutation({
      query: (body) => ({
        url: "/expenses",
        method: "POST",
        body,
      }),
      transformResponse: (res) => {
        const b = unwrap(res);
        return withId(b?.expense ?? b);
      },
      invalidatesTags: EXPENSE_TAGS,
    }),

    // --------------------------------------------------
    // UPDATE EXPENSE (offline-capable)
    // --------------------------------------------------
    updateExpense: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/expenses/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (res) => {
        const b = unwrap(res);
        return withId(b?.expense ?? b);
      },
      invalidatesTags: EXPENSE_TAGS,
    }),

    // --------------------------------------------------
    // DELETE EXPENSE (offline-capable)
    // --------------------------------------------------
    deleteExpense: builder.mutation({
      query: (id) => ({
        url: `/expenses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: EXPENSE_TAGS,
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS (unchanged names)
// ======================================================

export const {
  useGetExpensesQuery,
  useLazyGetExpensesQuery,
  useGetExpenseStatsQuery,
  useLazyGetExpenseStatsQuery,
  useGetExpenseQuery,
  useLazyGetExpenseQuery,
  useGetDriverBookingBalanceQuery,
  useLazyGetDriverBookingBalanceQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = expenseApi;