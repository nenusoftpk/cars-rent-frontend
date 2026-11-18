/**
 * src/redux/api/paymentApi.js
 *
 * Full online + offline support for payments.
 *
 * READS   → fully offline-capable
 * CREATE  → offline supported for cash payments only (no proof file)
 * Other mutations (security, refund, void) → online-only
 *
 * Same hooks + argument shapes → zero page changes.
 */

import { baseApi, clean } from "./baseApi";
import {
  unwrap,
  mapBooking,
  mapBookingParams,
  mapPayment,
  payMethod,
  payTypeEnum,
} from "./bookingApi";
import {
  isBrowserOnline,
  isNetworkFailure,
  executeOffline,
  shouldUseOffline,
} from "@/offline/offlineAdapter";

// ======================================================
// CACHE TAGS
// ======================================================

const PAYMENT_TAGS = [
  "Payments",
  "Bookings",
  "Customers",
  "Reports",
  "Dashboard",
  "Expenses",
  "Cars",
  "Drivers",
  "Profits",
  "Ledger",
];

// ======================================================
// HELPERS
// ======================================================

const asBlob = (v) =>
  v instanceof Blob ? v : v?.file instanceof Blob ? v.file : null;

const isRealFile = (v) =>
  typeof File !== "undefined" && v instanceof File;

/**
 * Build FormData for online requests (with optional proof)
 */
function paymentForm(b = {}, type = null) {
  const fd = new FormData();
  const add = (k, v) => {
    if (v !== undefined && v !== null && v !== "") fd.append(k, String(v));
  };
  const method = payMethod(b.method);

  add("bookingId", b.bookingId);
  if (type) add("type", type);
  add("amount", b.amount);
  add("method", method);
  add("paymentDate", b.paymentDate ?? b.date);
  add("notes", b.notes ?? b.note);
  add("transactionReference", b.transactionReference);
  add("idempotencyKey", b.idempotencyKey ?? b.requestId);

  if (method && method !== "cash") {
    const proof = asBlob(b.paymentProof ?? b.proof);
    if (proof) {
      fd.append("paymentProof", proof, proof.name || "payment-proof.jpg");
    }
  }
  return fd;
}

/**
 * Plain JSON body for offline create (no files allowed)
 */
function paymentJSON(b = {}, type = null) {
  const method = payMethod(b.method);

  return {
    bookingId: b.bookingId,
    type: type || payTypeEnum(b.type) || "rental",
    amount: Number(b.amount) || 0,
    method,
    paymentDate: b.paymentDate ?? b.date ?? new Date().toISOString(),
    notes: b.notes ?? b.note ?? "",
    transactionReference: b.transactionReference || "",
    idempotencyKey: b.idempotencyKey ?? b.requestId,
    // Extra fields that help UI while offline
    status: "pending",
    _isLocal: true,
  };
}

/** UI "Payment For" label → which endpoint + backend type */
function routeFor(b = {}) {
  const t = payTypeEnum(b.type);
  if (t === "security_deposit") {
    return { url: "/payments/security/receive", type: null };
  }
  if (t === "security_refund") {
    return { url: "/payments/security/refund", type: null };
  }
  if (t === "refund" && b.originalPaymentId) {
    return {
      url: `/payments/${b.originalPaymentId}/refund`,
      type: null,
    };
  }
  return { url: "/payments", type: t || "rental" };
}

const flatten = (body, items) => {
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

function mapPaymentParams(p = {}) {
  const q = {};
  const put = (k, v) => {
    if (v !== undefined && v !== null && v !== "") q[k] = v;
  };
  put("page", p.page);
  put("limit", p.pageSize ?? p.limit);
  put("search", typeof p.search === "string" ? p.search.trim() : p.search);
  put("from", p.from);
  put("to", p.to);
  put("bookingId", p.bookingId);
  put("type", p.type ? payTypeEnum(p.type) : "");
  put("method", p.method ? payMethod(p.method) : "");
  put("status", p.status);
  return q;
}

const paymentStatusOf = (b) =>
  b.total > 0 && b.balance <= 0
    ? "Paid"
    : b.paid > 0
      ? "Partial"
      : "Unpaid";

// ======================================================
// BUSINESS CONTEXT
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

  if (!businessId || user.role !== "admin") {
    return null;
  }

  return {
    businessId: String(businessId),
    accessFilter: (r) => String(r.businessId) === String(businessId),
  };
}

// ======================================================
// LOCAL FALLBACKS (READS)
// ======================================================

async function localPaymentList(params, api) {
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
    entity: "payment",
    businessId: ctx.businessId,
    params: {
      ...params,
      limit: params.limit ?? params.pageSize ?? 50,
    },
    accessFilter: ctx.accessFilter,
    mapper: mapPayment,
  });
}

async function localPaymentGet(id, api) {
  const ctx = await getBusinessContext(api);
  if (!ctx) return { data: null };

  const result = await executeOffline({
    action: "get",
    entity: "payment",
    businessId: ctx.businessId,
    id,
    accessFilter: ctx.accessFilter,
    mapper: mapPayment,
  });

  if (result.error) return { data: null };
  return { data: result.data };
}

async function localPaymentStats(params, api) {
  const ctx = await getBusinessContext(api);
  if (!ctx) {
    return {
      data: {
        count: 0,
        received: 0,
        depositsIn: 0,
        depositsOut: 0,
        totalTransactions: 0,
        netRentalReceived: 0,
        securityReceived: 0,
        securityRefunded: 0,
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "payment",
    businessId: ctx.businessId,
    params: {
      from: params.from,
      to: params.to,
      limit: 3000,
    },
    accessFilter: ctx.accessFilter,
    mapper: mapPayment,
  });

  if (result.error) {
    return {
      data: {
        count: 0,
        received: 0,
        depositsIn: 0,
        depositsOut: 0,
        totalTransactions: 0,
        netRentalReceived: 0,
        securityReceived: 0,
        securityRefunded: 0,
        _offline: true,
      },
    };
  }

  const items = result.data?.items || [];
  let received = 0;
  let depositsIn = 0;
  let depositsOut = 0;

  for (const p of items) {
    const amount = Number(p.amount) || 0;
    const type = String(p.rawType || p.type || "").toLowerCase();

    if (type.includes("refund") || type === "security_refund") {
      depositsOut += amount;
    } else if (type === "security_deposit" || type.includes("deposit")) {
      depositsIn += amount;
    } else {
      received += amount;
    }
  }

  return {
    data: {
      count: items.length,
      totalTransactions: items.length,
      received,
      netRentalReceived: received,
      depositsIn,
      securityReceived: depositsIn,
      depositsOut,
      securityRefunded: depositsOut,
      _offline: true,
    },
  };
}

async function localBookingPayments(bookingId, params, api) {
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
    entity: "payment",
    businessId: ctx.businessId,
    params: {
      bookingId,
      limit: params.limit ?? params.pageSize ?? 100,
      page: params.page,
    },
    accessFilter: ctx.accessFilter,
    mapper: mapPayment,
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

  const items = (result.data?.items || []).filter(
    (p) => String(p.bookingId) === String(bookingId)
  );

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
// OFFLINE CREATE HELPER
// ======================================================

/**
 * Decide if this payment can be created offline.
 * Rules:
 * - Must be cash (no proof file required)
 * - Must have idempotencyKey
 * - Must not be security deposit / refund / void
 * - No File / Blob attached
 */
function canCreateOffline(body = {}) {
  const method = payMethod(body.method);
  const type = payTypeEnum(body.type);

  // Only normal rental payments
  if (["security_deposit", "security_refund", "refund"].includes(type)) {
    return false;
  }

  // Only cash is safe offline (no proof required)
  if (method !== "cash") {
    return false;
  }

  // Must have stable idempotency key
  if (!body.idempotencyKey && !body.requestId) {
    return false;
  }

  // Must not contain any file
  if (
    isRealFile(body.paymentProof) ||
    isRealFile(body.proof) ||
    asBlob(body.paymentProof) ||
    asBlob(body.proof)
  ) {
    return false;
  }

  return true;
}

// ======================================================
// PAYMENT API
// ======================================================

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // LIST PAYMENTS
    // --------------------------------------------------
    getPayments: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/payments",
            params: mapPaymentParams(params),
          });

          if (!result.error) {
            const body = unwrap(result.data) || {};
            return {
              data: flatten(body, (body.items || []).map(mapPayment)),
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localPaymentList(params, api);
      },
      providesTags: ["Payments"],
    }),

    // --------------------------------------------------
    // PAYMENT STATS
    // --------------------------------------------------
    getPaymentStats: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/payments/stats",
            params: clean({ from: params.from, to: params.to }),
          });

          if (!result.error) {
            const s = unwrap(result.data) || {};
            return {
              data: {
                ...s,
                count: s.totalTransactions,
                received: s.netRentalReceived,
                depositsIn: s.securityReceived,
                depositsOut: s.securityRefunded,
              },
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localPaymentStats(params, api);
      },
      providesTags: ["Payments", "Reports", "Dashboard"],
    }),

    // --------------------------------------------------
    // SINGLE PAYMENT
    // --------------------------------------------------
    getPayment: builder.query({
      async queryFn(id, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/payments/${id}`,
          });

          if (!result.error) {
            return { data: mapPayment(unwrap(result.data)) };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localPaymentGet(id, api);
      },
      providesTags: (result, error, id) => [
        "Payments",
        { type: "Payments", id },
      ],
    }),

    // --------------------------------------------------
    // BOOKING BALANCE (online-only)
    // --------------------------------------------------
    getBookingBalance: builder.query({
      query: (bookingId) => `/payments/booking/${bookingId}/balance`,
      providesTags: (result, error, bookingId) => [
        "Payments",
        { type: "Bookings", id: bookingId },
      ],
    }),

    // --------------------------------------------------
    // PAYMENTS OF A BOOKING
    // --------------------------------------------------
    getBookingPayments: builder.query({
      async queryFn({ bookingId, ...params }, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/payments/booking/${bookingId}`,
            params: clean({
              page: params.page,
              limit: params.pageSize ?? params.limit,
            }),
          });

          if (!result.error) {
            const body = unwrap(result.data) || {};
            return {
              data: flatten(body, (body.items || []).map(mapPayment)),
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localBookingPayments(bookingId, params, api);
      },
      providesTags: (result, error, { bookingId }) => [
        "Payments",
        { type: "Bookings", id: bookingId },
      ],
    }),

    // --------------------------------------------------
    // INVOICES (derived from bookings)
    // --------------------------------------------------
    getInvoices: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/bookings",
            params: mapBookingParams({
              page: params.page,
              pageSize: params.pageSize,
              search: params.search,
              from: params.from,
              to: params.to,
              customerId: params.customerId,
            }),
          });

          if (!result.error) {
            const body = unwrap(result.data) || {};
            let items = (body.items || [])
              .map(mapBooking)
              .filter((b) => b.status !== "Cancelled")
              .map((b) => ({
                ...b,
                paymentStatus: paymentStatusOf(b),
              }));

            if (params.paymentStatus) {
              items = items.filter(
                (b) => b.paymentStatus === params.paymentStatus
              );
            }

            const out = flatten(body, items);
            out.summary = {
              count: out.total,
              billed: items.reduce((s, b) => s + (b.total || 0), 0),
              received: items.reduce((s, b) => s + (b.paid || 0), 0),
              pending: items.reduce((s, b) => s + (b.balance || 0), 0),
            };
            return { data: out };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline → use offline bookings
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
              summary: { count: 0, billed: 0, received: 0, pending: 0 },
              _offline: true,
            },
          };
        }

        const result = await executeOffline({
          action: "list",
          entity: "booking",
          businessId: ctx.businessId,
          params: {
            ...params,
            limit: params.limit ?? params.pageSize ?? 50,
          },
          accessFilter: ctx.accessFilter,
          mapper: mapBooking,
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
              summary: { count: 0, billed: 0, received: 0, pending: 0 },
              _offline: true,
            },
          };
        }

        let items = (result.data?.items || [])
          .filter((b) => b.status !== "Cancelled")
          .map((b) => ({
            ...b,
            paymentStatus: paymentStatusOf(b),
          }));

        if (params.paymentStatus) {
          items = items.filter(
            (b) => b.paymentStatus === params.paymentStatus
          );
        }

        return {
          data: {
            ...result.data,
            items,
            summary: {
              count: items.length,
              billed: items.reduce((s, b) => s + (b.total || 0), 0),
              received: items.reduce((s, b) => s + (b.paid || 0), 0),
              pending: items.reduce((s, b) => s + (b.balance || 0), 0),
            },
            _offline: true,
          },
        };
      },
      providesTags: ["Bookings", "Payments"],
    }),

    // --------------------------------------------------
    // DEPOSITS
    // --------------------------------------------------
    getDeposits: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/bookings",
            params: mapBookingParams({
              page: params.page,
              pageSize: params.pageSize,
              search: params.search,
              customerId: params.customerId,
            }),
          });

          if (!result.error) {
            const body = unwrap(result.data) || {};
            let items = (body.items || [])
              .map(mapBooking)
              .filter((b) => b.depositPaid > 0);

            if (params.state === "held") {
              items = items.filter((b) => b.depositHeld > 0);
            }
            if (params.state === "returned") {
              items = items.filter((b) => b.depositHeld <= 0);
            }

            const out = flatten(body, items);
            out.summary = {
              count: items.filter((b) => b.depositHeld > 0).length,
              held: items.reduce((s, b) => s + (b.depositHeld || 0), 0),
            };
            return { data: out };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline fallback
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
              summary: { count: 0, held: 0 },
              _offline: true,
            },
          };
        }

        const result = await executeOffline({
          action: "list",
          entity: "booking",
          businessId: ctx.businessId,
          params: {
            ...params,
            limit: params.limit ?? params.pageSize ?? 50,
          },
          accessFilter: ctx.accessFilter,
          mapper: mapBooking,
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
              summary: { count: 0, held: 0 },
              _offline: true,
            },
          };
        }

        let items = (result.data?.items || []).filter(
          (b) => b.depositPaid > 0
        );

        if (params.state === "held") {
          items = items.filter((b) => b.depositHeld > 0);
        }
        if (params.state === "returned") {
          items = items.filter((b) => b.depositHeld <= 0);
        }

        return {
          data: {
            ...result.data,
            items,
            summary: {
              count: items.filter((b) => b.depositHeld > 0).length,
              held: items.reduce((s, b) => s + (b.depositHeld || 0), 0),
            },
            _offline: true,
          },
        };
      },
      providesTags: ["Bookings", "Payments"],
    }),

    // ==================================================
    // MUTATIONS
    // ==================================================

    // --------------------------------------------------
    // ADD PAYMENT  (offline-capable for cash only)
    // --------------------------------------------------
    addPayment: builder.mutation({
      async queryFn(body, api, _extraOptions, baseQuery) {
        const r = routeFor(body);

        // 1. Try online first
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: r.url,
            method: "POST",
            body: paymentForm(body, r.type),
          });

          if (!result.error) {
            return { data: mapPayment(unwrap(result.data)) };
          }

          // Real backend error → surface it
          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // 2. Offline path
        if (!canCreateOffline(body)) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              data: {
                success: false,
                message:
                  "This payment cannot be saved offline. Only cash payments without proof are supported offline. Please connect to the internet.",
              },
              error:
                "Offline payment only supported for cash (no proof file).",
            },
          };
        }

        const ctx = await getBusinessContext(api);
        if (!ctx) {
          return {
            error: {
              status: 403,
              data: {
                success: false,
                message: "Business context required for offline payment.",
              },
            },
          };
        }

        const payload = paymentJSON(body, r.type);

        const result = await executeOffline({
          action: "create",
          entity: "payment",
          businessId: ctx.businessId,
          payload,
          accessFilter: ctx.accessFilter,
          mapper: mapPayment,
        });

        return result;
      },
      invalidatesTags: PAYMENT_TAGS,
    }),

    // --------------------------------------------------
    // RECEIVE SECURITY (online-only)
    // --------------------------------------------------
    receiveSecurity: builder.mutation({
      query: (body) => ({
        url: "/payments/security/receive",
        method: "POST",
        body: paymentForm(body),
      }),
      transformResponse: (res) => mapPayment(unwrap(res)),
      invalidatesTags: PAYMENT_TAGS,
    }),

    // --------------------------------------------------
    // REFUND SECURITY (online-only)
    // --------------------------------------------------
    refundSecurity: builder.mutation({
      query: (body) => ({
        url: "/payments/security/refund",
        method: "POST",
        body: paymentForm(body),
      }),
      transformResponse: (res) => mapPayment(unwrap(res)),
      invalidatesTags: PAYMENT_TAGS,
    }),

    // --------------------------------------------------
    // REFUND PAYMENT (online-only)
    // --------------------------------------------------
    refundPayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/payments/${id}/refund`,
        method: "POST",
        body: paymentForm(body),
      }),
      transformResponse: (res) => mapPayment(unwrap(res)),
      invalidatesTags: PAYMENT_TAGS,
    }),

    // --------------------------------------------------
    // VOID PAYMENT (online-only)
    // --------------------------------------------------
    voidPayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/payments/${id}/void`,
        method: "POST",
        body,
      }),
      invalidatesTags: PAYMENT_TAGS,
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS
// ======================================================

export const {
  useGetPaymentsQuery,
  useLazyGetPaymentsQuery,
  useGetPaymentStatsQuery,
  useLazyGetPaymentStatsQuery,
  useGetPaymentQuery,
  useLazyGetPaymentQuery,
  useGetBookingBalanceQuery,
  useLazyGetBookingBalanceQuery,
  useGetBookingPaymentsQuery,
  useLazyGetBookingPaymentsQuery,
  useGetInvoicesQuery,
  useLazyGetInvoicesQuery,
  useGetDepositsQuery,
  useLazyGetDepositsQuery,
  useAddPaymentMutation,
  useReceiveSecurityMutation,
  useRefundSecurityMutation,
  useRefundPaymentMutation,
  useVoidPaymentMutation,
} = paymentApi;