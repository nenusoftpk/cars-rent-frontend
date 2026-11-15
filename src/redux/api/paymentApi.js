import { baseApi, clean } from "./baseApi";
import {
  unwrap,
  mapBooking,
  mapBookingParams,
  mapPayment,
  payMethod,
  payTypeEnum,
} from "./bookingApi";

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

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const asBlob = (v) => (v instanceof Blob ? v : v?.file instanceof Blob ? v.file : null);

/**
 * Receipts are multipart (field `paymentProof` is the optional screenshot).
 * Backend rules: bank / jazzcash / easypaisa REQUIRE a screenshot, cash must NOT have one,
 * card / other: optional. `idempotencyKey` is required (the UI's requestId).
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
    if (proof) fd.append("paymentProof", proof, proof.name || "payment-proof.jpg");
  }
  return fd;
}

/** UI "Payment For" label → which endpoint + backend type */
function routeFor(b = {}) {
  const t = payTypeEnum(b.type);
  if (t === "security_deposit") return { url: "/payments/security/receive", type: null };
  if (t === "security_refund") return { url: "/payments/security/refund", type: null };
  if (t === "refund" && b.originalPaymentId) {
    return { url: `/payments/${b.originalPaymentId}/refund`, type: null };
  }
  return { url: "/payments", type: t || "rental" }; // advance | rental | final
}

const flatten = (body, items) => {
  const p = body.pagination || {};
  return {
    items,
    pagination: p,
    page: p.page ?? 1,
    pageSize: p.limit ?? items.length,
    total: p.total ?? items.length,
    totalPages: p.totalPages ?? 1,
  };
};

/** GET /payments only reads: page, limit|pageSize, search, from, to, bookingId, type, method, status */
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
  b.total > 0 && b.balance <= 0 ? "Paid" : b.paid > 0 ? "Partial" : "Unpaid";

export const paymentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ---------------- payment history ----------------
    getPayments: builder.query({
      query: (params = {}) => ({
        url: "/payments",
        params: mapPaymentParams(params),
      }),
      transformResponse: (res) => {
        const body = unwrap(res) || {};
        return flatten(body, (body.items || []).map(mapPayment));
      },
      providesTags: ["Payments"],
    }),

    // GET /payments/stats → mapped to the names the Billing cards use
    getPaymentStats: builder.query({
      query: (params = {}) => ({
        url: "/payments/stats",
        params: clean({ from: params.from, to: params.to }),
      }),
      transformResponse: (res) => {
        const s = unwrap(res) || {};
        return {
          ...s,
          count: s.totalTransactions,
          received: s.netRentalReceived,
          depositsIn: s.securityReceived,
          depositsOut: s.securityRefunded,
        };
      },
      providesTags: ["Payments", "Reports", "Dashboard"],
    }),

    getPayment: builder.query({
      query: (id) => `/payments/${id}`,
      transformResponse: (res) => mapPayment(unwrap(res)),
      providesTags: (result, error, id) => ["Payments", { type: "Payments", id }],
    }),

    getBookingBalance: builder.query({
      query: (bookingId) => `/payments/booking/${bookingId}/balance`,
      providesTags: (result, error, bookingId) => [
        "Payments",
        { type: "Bookings", id: bookingId },
      ],
    }),

    getBookingPayments: builder.query({
      query: ({ bookingId, ...params }) => ({
        url: `/payments/booking/${bookingId}`,
        params: clean({ page: params.page, limit: params.pageSize ?? params.limit }),
      }),
      transformResponse: (res) => {
        const body = unwrap(res) || {};
        return flatten(body, (body.items || []).map(mapPayment));
      },
      providesTags: (result, error, { bookingId }) => [
        "Payments",
        { type: "Bookings", id: bookingId },
      ],
    }),

    // ---------------- Billing tabs built from /bookings ----------------
    // The backend has no /invoices or /deposits endpoint: both are views of bookings.
    // Filtering by payment status / deposit state happens on the rows of the loaded page.
    getInvoices: builder.query({
      query: (params = {}) => ({
        url: "/bookings",
        params: mapBookingParams({
          page: params.page,
          pageSize: params.pageSize,
          search: params.search,
          from: params.from,
          to: params.to,
          customerId: params.customerId,
        }),
      }),
      transformResponse: (res, _meta, arg = {}) => {
        const body = unwrap(res) || {};
        let items = (body.items || [])
          .map(mapBooking)
          .filter((b) => b.status !== "Cancelled")
          .map((b) => ({ ...b, paymentStatus: paymentStatusOf(b) }));
        if (arg.paymentStatus) items = items.filter((b) => b.paymentStatus === arg.paymentStatus);
        const out = flatten(body, items);
        out.summary = {
          count: out.total,
          billed: items.reduce((s, b) => s + b.total, 0),
          received: items.reduce((s, b) => s + b.paid, 0),
          pending: items.reduce((s, b) => s + b.balance, 0),
        };
        return out;
      },
      providesTags: ["Bookings", "Payments"],
    }),

    getDeposits: builder.query({
      query: (params = {}) => ({
        url: "/bookings",
        params: mapBookingParams({
          page: params.page,
          pageSize: params.pageSize,
          search: params.search,
          customerId: params.customerId,
        }),
      }),
      transformResponse: (res, _meta, arg = {}) => {
        const body = unwrap(res) || {};
        let items = (body.items || []).map(mapBooking).filter((b) => b.depositPaid > 0);
        if (arg.state === "held") items = items.filter((b) => b.depositHeld > 0);
        if (arg.state === "returned") items = items.filter((b) => b.depositHeld <= 0);
        const out = flatten(body, items);
        out.summary = {
          count: items.filter((b) => b.depositHeld > 0).length,
          held: items.reduce((s, b) => s + b.depositHeld, 0),
        };
        return out;
      },
      providesTags: ["Bookings", "Payments"],
    }),

    // ---------------- create receipts / refunds ----------------
    // One mutation for the Receive Payment modal. The "Payment For" label decides the route:
    //  Advance / Partial / Full → POST /payments (type advance|rental|final)
    //  Security Deposit         → POST /payments/security/receive
    //  Deposit Refund           → POST /payments/security/refund
    //  Advance Refund (+ originalPaymentId) → POST /payments/:id/refund
    addPayment: builder.mutation({
      query: (body) => {
        const r = routeFor(body);
        return { url: r.url, method: "POST", body: paymentForm(body, r.type) };
      },
      transformResponse: (res) => mapPayment(unwrap(res)),
      invalidatesTags: PAYMENT_TAGS,
    }),

    receiveSecurity: builder.mutation({
      query: (body) => ({
        url: "/payments/security/receive",
        method: "POST",
        body: paymentForm(body),
      }),
      transformResponse: (res) => mapPayment(unwrap(res)),
      invalidatesTags: PAYMENT_TAGS,
    }),

    refundSecurity: builder.mutation({
      query: (body) => ({
        url: "/payments/security/refund",
        method: "POST",
        body: paymentForm(body),
      }),
      transformResponse: (res) => mapPayment(unwrap(res)),
      invalidatesTags: PAYMENT_TAGS,
    }),

    refundPayment: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/payments/${id}/refund`,
        method: "POST",
        body: paymentForm(body),
      }),
      transformResponse: (res) => mapPayment(unwrap(res)),
      invalidatesTags: PAYMENT_TAGS,
    }),

    // admin only, JSON, never a file
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