/**
 * src/redux/api/bookingApi.js
 *
 * Full online + offline support for bookings.
 *
 * - List / get / create / update work offline via baseApi + offlineAdapter
 * - Stats & availability have high-quality local fallbacks
 * - extend / cancel remain online-only (special routes + business rules)
 * - Same hooks, same argument shapes, zero page changes
 */

import { baseApi, clean } from "./baseApi";
import { PAYMENT_METHODS } from "@/constants";
import {
  isBrowserOnline,
  isNetworkFailure,
  executeOffline,
} from "@/offline/offlineAdapter";

// ======================================================
// CACHE TAGS
// ======================================================

const BOOKING_TAGS = [
  "Bookings",
  "Cars",
  "Inspections",
  "Payments",
  "Customers",
  "Reports",
  "Dashboard",
  "Reminders",
  "Documents",
  "Expenses",
  "Profits",
  "Ledger",
];

/**
 * GET /bookings only reads: page, limit, search, status, customerId, carId,
 * employeeId, from, to. Sorting is always createdAt desc on the server.
 * Set to true only after backend supports the extra params.
 */
const SERVER_LIST_EXTRAS = false;

/* ------------------------------------------------------------------ */
/* Shared helpers (also imported by carApi / carInspectionApi / paymentApi) */
/* ------------------------------------------------------------------ */

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

/** Accept both `{...}` and `{ success, data: {...} }` envelopes. */
export const unwrap = (r) =>
  isObj(r) && isObj(r.data) && r.items === undefined && r.id === undefined
    ? r.data
    : r;

export const idOf = (v) => (isObj(v) ? v.id || v._id : v) || "";

const toEnum = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const cap = (s) => {
  const v = String(s ?? "").replace(/_/g, " ").trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
};

const BOOKING_LABEL = {
  reserved: "Reserved",
  on_rent: "On Rent",
  completed: "Completed",
  cancelled: "Cancelled",
};
export const bookingLabel = (s) => BOOKING_LABEL[toEnum(s)] || s || "";

/** local "2026-11-12T10:00" → real ISO instant for the backend */
export const toIso = (v) => {
  if (!v) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
};

/* ---------------- payments: labels <-> backend enums ---------------- */

/** UI payment-method label → backend enum */
export const payMethod = (m) => {
  const s = String(m || "").toLowerCase();
  if (!s) return "";
  if (s.includes("cash")) return "cash";
  if (s.includes("bank")) return "bank";
  if (s.includes("jazz")) return "jazzcash";
  if (s.includes("easy")) return "easypaisa";
  if (s.includes("card")) return "card";
  return "other";
};

/** backend method enum → the label used by PAYMENT_METHODS */
export const payMethodLabel = (m) => {
  if (!m) return "";
  if (PAYMENT_METHODS.includes(m)) return m;
  return PAYMENT_METHODS.find((x) => payMethod(x) === m) || cap(m);
};

const TYPE_LABEL = {
  advance: "Advance",
  rental: "Partial",
  final: "Full",
  refund: "Advance Refund",
  security_deposit: "Security Deposit",
  security_refund: "Deposit Refund",
};
const TYPE_ENUM = {
  advance: "advance",
  partial: "rental",
  rent: "rental",
  rental: "rental",
  full: "final",
  final: "final",
  advance_refund: "refund",
  rental_refund: "refund",
  refund: "refund",
  security_deposit: "security_deposit",
  deposit_refund: "security_refund",
  security_refund: "security_refund",
};
export const payTypeLabel = (t) => TYPE_LABEL[t] || t || "";
export const payTypeEnum = (t) => TYPE_ENUM[toEnum(t)] || toEnum(t);

/** backend payment → UI shape */
export function mapPayment(p) {
  if (!p) return p;
  const booking = isObj(p.bookingId) ? p.bookingId : null;
  const customer = booking && isObj(booking.customerId) ? booking.customerId : null;
  const receiver = isObj(p.receivedBy) ? p.receivedBy : null;
  return {
    ...p,
    id: p.id || p._id,
    receiptNo: p.receiptNo ?? p.paymentNumber ?? "",
    bookingId: idOf(p.bookingId),
    bookingNumber: p.bookingNumber ?? booking?.bookingNumber ?? "",
    customerName: p.customerName ?? customer?.name ?? "",
    rawType: p.rawType ?? p.type,
    type: payTypeLabel(p.type),
    rawMethod: p.rawMethod ?? p.method,
    method: payMethodLabel(p.method),
    amount: Number(p.amount ?? 0),
    date: p.date ?? p.paymentDate ?? p.createdAt,
    note: p.note ?? p.notes ?? p.transactionReference ?? "",
    receivedByName: p.receivedByName ?? receiver?.name ?? "",
    proof: p.paymentProof || "",
  };
}

/* ---------------- inspections / bookings ---------------- */

/** backend inspection → UI shape */
export function mapInspection(i) {
  if (!i) return null;
  return {
    ...i,
    id: i.id || i._id,
    at: i.at ?? i.inspectionDate ?? i.createdAt,
    meter: i.meter ?? i.meterReading ?? 0,
    fuel: i.fuel ?? i.fuelLevel ?? "",
    damage: i.damage ?? i.damageNotes ?? "",
    photos: Array.isArray(i.photos) ? i.photos : [],
    staffName: i.staffName ?? i.inspectedBy?.name ?? i.inspectedBy?.fullName ?? "",
  };
}

const RAW_CHARGE_ROWS = [
  ["extraKmCharges", "Extra Kilometer Charge"],
  ["lateCharges", "Late Return Charge"],
  ["damageCharges", "Damage Charge"],
  ["fuelCharges", "Fuel Charge"],
  ["extraDayCharges", "Extra Day Charge"],
  ["otherCharges", "Other Charge"],
];

/**
 * Normalize any booking (online or offline) to the shape pages expect.
 */
export function mapBooking(b) {
  if (!b) return b;
  const cust = isObj(b.customerId) ? b.customerId : b.customer || {};
  const car = isObj(b.carId) ? b.carId : b.car || {};
  const emp = isObj(b.employeeId) ? b.employeeId : b.employee || {};
  const drv = isObj(b.driverId) ? b.driverId : b.driver || {};

  const status = bookingLabel(b.status);
  const returnAt = b.returnAt ?? b.returnDate;

  let charges = Array.isArray(b.charges) ? b.charges : [];
  if (b.charges === undefined) {
    charges = RAW_CHARGE_ROWS.filter(([k]) => Number(b[k]) > 0).map(([k, label]) => ({
      label,
      amount: Number(b[k]),
    }));
  }

  const total = Number(b.total ?? b.totalAmount ?? 0);
  const paid = Number(b.paid ?? b.totalPaid ?? 0);
  const depositPaid = Number(b.depositPaid ?? b.securityReceived ?? 0);
  const depositRefunded = Number(b.depositRefunded ?? b.securityRefunded ?? 0);
  const depositAdjusted = Number(b.depositAdjusted ?? b.securityDeduction ?? 0);

  return {
    ...b,
    id: b.id || b._id,
    number: b.number ?? b.bookingNumber,
    invoiceNo: b.invoiceNo ?? b.invoiceNumber,

    customerId: idOf(b.customerId) || b.customerId,
    customerName: b.customerName ?? cust.name ?? "",
    customerMobile: b.customerMobile ?? cust.mobile ?? cust.phone ?? "",
    customerPhoto: b.customerPhoto ?? cust.photo ?? "",

    carId: idOf(b.carId) || b.carId,
    carName: b.carName ?? car.name ?? "",
    carPlate: b.carPlate ?? car.plate ?? car.numberPlate ?? "",
    carImage: b.carImage ?? car.image ?? car.images?.[0] ?? "",
    car: isObj(b.car) ? b.car : isObj(b.carId) ? b.carId : b.car,

    driverId: idOf(b.driverId) || "",
    driverName: b.driverName ?? drv.name ?? "",
    staffId: b.staffId ?? idOf(b.employeeId) ?? "",
    staffName: b.staffName ?? emp.name ?? emp.fullName ?? "",

    pickupAt: b.pickupAt ?? b.pickupDate,
    returnAt,
    pickupLocation: b.pickupLocation ?? "",
    returnLocation: b.returnLocation ?? "",
    instructions: b.instructions ?? b.specialInstructions ?? "",

    rateType: b.rateType ?? b.rentType ?? "daily",
    rate: b.rate ?? b.rentRate ?? 0,
    days: b.days ?? b.rentalUnits ?? 0,
    rentAmount: b.rentAmount ?? b.rentalAmount ?? 0,
    charges,
    additionalTotal:
      b.additionalTotal ?? charges.reduce((s, c) => s + (Number(c.amount) || 0), 0),

    total,
    paid,
    balance: b.balance ?? Math.max(total - paid, 0),

    depositPaid,
    depositRefunded,
    depositAdjusted,
    depositHeld:
      b.depositHeld ?? Math.max(depositPaid - depositRefunded - depositAdjusted, 0),

    status,
    displayStatus: b.displayStatus ? bookingLabel(b.displayStatus) : status,
    isOverdue:
      b.isOverdue ??
      (status === "On Rent" && returnAt ? new Date(returnAt).getTime() < Date.now() : false),

    issue: b.issue ? mapInspection(b.issue) : mapInspection(b.issueInspection),
    returnInfo: b.returnInfo ? mapInspection(b.returnInfo) : mapInspection(b.returnInspection),

    payments: Array.isArray(b.payments) ? b.payments.map(mapPayment) : b.payments,
    history: Array.isArray(b.history) ? b.history : [],

    // Offline markers (harmless online)
    _offline: b._offline || false,
    _pendingSync: b._pendingSync || false,
  };
}

/* ---------------- request mapping ---------------- */

/** New Booking form payload → backend body (create / update contract only) */
function mapBookingBody(b = {}) {
  const out = {};
  const put = (k, v) => {
    if (v !== undefined && v !== null && v !== "") out[k] = v;
  };

  put("customerId", b.customerId);
  put("carId", b.carId);
  if (b.driverId !== undefined) out.driverId = b.driverId || null;

  const emp = b.staffId ?? b.employeeId;
  if (emp !== undefined) out.employeeId = emp || null;

  put("pickupDate", toIso(b.pickupAt ?? b.pickupDate));
  put("returnDate", toIso(b.returnAt ?? b.returnDate));
  put("rentType", b.rateType ?? b.rentType);

  if (b.pickupLocation !== undefined) out.pickupLocation = b.pickupLocation;
  if (b.returnLocation !== undefined) {
    out.returnLocation =
      b.returnLocation === "Same as Pickup" ? b.pickupLocation || "" : b.returnLocation;
  }

  const notes = b.instructions ?? b.specialInstructions;
  if (notes !== undefined) out.specialInstructions = notes;

  if (b.discount !== undefined && b.discount !== "") out.discount = Number(b.discount) || 0;
  if (b.deposit !== undefined) out.securityDeposit = Number(b.deposit) || 0;

  return out;
}

const VIEW_STATUS = {
  reserved: "reserved",
  active: "on_rent",
  completed: "completed",
  cancelled: "cancelled",
};

const SORT_FIELD = {
  number: "bookingNumber",
  pickupAt: "pickupDate",
  returnAt: "returnDate",
  total: "totalAmount",
};

/** List params used by the UI → ONLY what GET /bookings accepts */
export function mapBookingParams(p = {}) {
  const q = {};
  const put = (k, v) => {
    if (v !== undefined && v !== null && v !== "") q[k] = v;
  };

  put("page", p.page);
  put("limit", p.pageSize ?? p.limit);
  put("search", typeof p.search === "string" ? p.search.trim() : p.search);
  put("customerId", p.customerId);
  put("carId", p.carId);
  put("employeeId", p.staffId ?? p.employeeId);

  let status = p.status ? toEnum(p.status) : "";
  let from = p.from;
  const view = p.view;

  if (status === "overdue") status = "on_rent";
  if (view && VIEW_STATUS[view] && !status) status = VIEW_STATUS[view];
  if (view === "upcoming") {
    if (!status) status = "reserved";
    if (!from) from = new Date().toISOString().slice(0, 10);
  }
  if (view === "overdue" && !status) status = "on_rent";

  put("status", status);
  put("from", from);
  put("to", p.to);

  if (SERVER_LIST_EXTRAS) {
    if (p.sort) {
      const [f, d] = String(p.sort).split(":");
      put("sort", `${SORT_FIELD[f] || f}:${d || "asc"}`);
    }
    put("dateField", p.dateField === "pickupAt" ? "pickupDate" : p.dateField);
    if (view === "upcoming" || view === "overdue") put("view", view);
  }
  return q;
}

/** Client-side sort (backend always sorts createdAt desc) */
const sortItems = (items, sort) => {
  if (!sort) return items;
  const [field, dir] = String(sort).split(":");
  const k = dir === "desc" ? -1 : 1;
  const val = (b) => {
    const v = b[field];
    if (["pickupAt", "returnAt", "createdAt"].includes(field)) return new Date(v).getTime() || 0;
    return typeof v === "number" ? v : String(v ?? "").toLowerCase();
  };
  return [...items].sort((a, b) => (val(a) > val(b) ? k : val(a) < val(b) ? -k : 0));
};

/** Normalize list response shape */
const flatten = (body, items) => {
  const p = body.pagination || {};
  return {
    items,
    pagination: p,
    page: body.page ?? p.page ?? 1,
    pageSize: body.pageSize ?? p.limit ?? items.length,
    total: body.total ?? p.total ?? items.length,
    totalPages: body.totalPages ?? p.totalPages ?? 1,
    _offline: body._offline || false,
  };
};

// ======================================================
// LOCAL FALLBACKS (used when offline / network failure)
// ======================================================

/**
 * Approximate booking stats from the local IndexedDB cache.
 * Good enough for tab badges while offline.
 */
async function localBookingStats(api) {
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
    return {
      data: {
        total: 0,
        reserved: 0,
        onRent: 0,
        completed: 0,
        cancelled: 0,
        all: 0,
        active: 0,
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "booking",
    businessId: String(businessId),
    params: { limit: 3000 },
    accessFilter: (r) => String(r.businessId) === String(businessId),
    mapper: mapBooking,
  });

  if (result.error) {
    return {
      data: {
        total: 0,
        reserved: 0,
        onRent: 0,
        completed: 0,
        cancelled: 0,
        all: 0,
        active: 0,
        _offline: true,
      },
    };
  }

  const items = result.data?.items || [];
  const stats = {
    total: items.length,
    reserved: 0,
    onRent: 0,
    completed: 0,
    cancelled: 0,
    _offline: true,
  };

  for (const b of items) {
    const s = toEnum(b.status);
    if (s === "reserved") stats.reserved += 1;
    else if (s === "on_rent") stats.onRent += 1;
    else if (s === "completed") stats.completed += 1;
    else if (s === "cancelled") stats.cancelled += 1;
  }

  return {
    data: {
      ...stats,
      all: stats.total,
      active: stats.onRent,
    },
  };
}

/**
 * Provisional local availability check.
 * Looks at cached bookings for the same car and overlapping dates.
 * Result is marked so the UI can show “provisional – confirm when online”.
 */
async function localAvailability(args, api) {
  const state = api.getState();
  const auth = state?.auth || {};
  const user = auth.user || {};
  const businessId =
    auth.businessId ||
    user.businessId ||
    user.business?._id ||
    user.business?.id ||
    null;

  if (!businessId || !args.carId) {
    return {
      data: {
        available: true,
        message: "Unable to verify availability offline. Will be re-checked on sync.",
        provisional: true,
        _offline: true,
      },
    };
  }

  const from = new Date(args.from ?? args.pickupDate).getTime();
  const to = new Date(args.to ?? args.returnDate).getTime();
  const excludeId = args.excludeId ?? args.excludeBookingId;

  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return {
      data: {
        available: true,
        message: "Invalid dates for offline check.",
        provisional: true,
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "booking",
    businessId: String(businessId),
    params: { carId: args.carId, limit: 3000 },
    accessFilter: (r) => String(r.businessId) === String(businessId),
    mapper: mapBooking,
  });

  if (result.error) {
    return {
      data: {
        available: true,
        message: "Unable to verify availability offline. Will be re-checked on sync.",
        provisional: true,
        _offline: true,
      },
    };
  }

  const items = (result.data?.items || []).filter((b) => {
    if (excludeId && String(b.id) === String(excludeId)) return false;
    const status = toEnum(b.status);
    if (status === "cancelled" || status === "completed") return false;
    return true;
  });

  const conflict = items.some((b) => {
    const bFrom = new Date(b.pickupAt || b.pickupDate).getTime();
    const bTo = new Date(b.returnAt || b.returnDate).getTime();
    if (!Number.isFinite(bFrom) || !Number.isFinite(bTo)) return false;
    // Overlap: (startA < endB) && (startB < endA)
    return from < bTo && bFrom < to;
  });

  return {
    data: {
      available: !conflict,
      message: conflict
        ? "This car appears to be booked for these dates (offline check)."
        : "No conflicting bookings found offline. Final confirmation on sync.",
      provisional: true,
      _offline: true,
    },
  };
}

// ======================================================
// BOOKING API
// ======================================================

export const bookingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // LIST BOOKINGS
    // --------------------------------------------------
    getBookings: builder.query({
      query: (params = {}) => ({
        url: "/bookings",
        method: "GET",
        params: mapBookingParams(params),
      }),
      transformResponse: (res, _meta, arg = {}) => {
        // Offline adapter already returns the correct shape + mapBooking can be applied
        const body = unwrap(res) || res || {};
        let items = (body.items || []).map(mapBooking);

        if (arg.view === "overdue" || toEnum(arg.status) === "overdue") {
          items = items.filter((b) => b.isOverdue);
        }
        if (!SERVER_LIST_EXTRAS) items = sortItems(items, arg.sort);

        return flatten(body, items);
      },
      providesTags: ["Bookings", "Payments"],
    }),

    // --------------------------------------------------
    // BOOKING STATS (with offline fallback)
    // --------------------------------------------------
    getBookingStats: builder.query({
      async queryFn(_arg, api, _extraOptions, baseQuery) {
        // Try online first
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/bookings/stats",
            method: "GET",
          });

          if (!result.error) {
            const s = unwrap(result.data) || {};
            return {
              data: {
                ...s,
                all: s.total,
                reserved: s.reserved,
                active: s.onRent,
                completed: s.completed,
                cancelled: s.cancelled,
              },
            };
          }

          // Network failure → fall through to local
          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline or network error → local approximation
        return localBookingStats(api);
      },
      providesTags: ["Bookings", "Dashboard"],
    }),

    // --------------------------------------------------
    // AVAILABILITY CHECK (with provisional offline fallback)
    // --------------------------------------------------
    checkAvailability: builder.query({
      async queryFn(args = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/bookings/availability",
            method: "GET",
            params: clean({
              carId: args.carId,
              pickupDate: toIso(args.from ?? args.pickupDate),
              returnDate: toIso(args.to ?? args.returnDate),
              excludeBookingId: args.excludeId ?? args.excludeBookingId,
            }),
          });

          if (!result.error) {
            const x = unwrap(result.data) || {};
            return {
              data: {
                ...x,
                available: x.available !== false,
                message: x.message || x.reason || "This car is already booked for these dates.",
                provisional: false,
              },
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline / network error → provisional local check
        return localAvailability(args, api);
      },
      providesTags: ["Bookings", "Cars"],
    }),

    // --------------------------------------------------
    // SINGLE BOOKING
    // --------------------------------------------------
    getBooking: builder.query({
      query: (id) => ({
        url: `/bookings/${id}`,
        method: "GET",
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapBooking(x?.booking ?? x);
      },
      providesTags: (result, error, id) => [
        { type: "Bookings", id },
        "Bookings",
        "Payments",
      ],
    }),

    // --------------------------------------------------
    // CREATE BOOKING (offline-capable)
    // --------------------------------------------------
    createBooking: builder.mutation({
      query: (body) => ({
        url: "/bookings",
        method: "POST",
        body: mapBookingBody(body),
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapBooking(x?.booking ?? x);
      },
      invalidatesTags: BOOKING_TAGS,
    }),

    // --------------------------------------------------
    // UPDATE BOOKING (offline-capable)
    // --------------------------------------------------
    updateBooking: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/bookings/${id}`,
        method: "PATCH",
        body: mapBookingBody(body),
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapBooking(x?.booking ?? x);
      },
      invalidatesTags: BOOKING_TAGS,
    }),

    // --------------------------------------------------
    // EXTEND BOOKING (online-only – special route)
    // --------------------------------------------------
    extendBooking: builder.mutation({
      query: ({ id, returnAt, returnDate }) => ({
        url: `/bookings/${id}/extend`,
        method: "PATCH",
        body: { returnDate: toIso(returnAt ?? returnDate) },
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapBooking(x?.booking ?? x);
      },
      invalidatesTags: BOOKING_TAGS,
    }),

    // --------------------------------------------------
    // CANCEL BOOKING (online-only – special route + money rules)
    // --------------------------------------------------
    cancelBooking: builder.mutation({
      query: ({ id, reason }) => ({
        url: `/bookings/${id}/cancel`,
        method: "PATCH",
        body: { reason: reason || "Cancelled by staff" },
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapBooking(x?.booking ?? x);
      },
      invalidatesTags: BOOKING_TAGS,
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS (unchanged names)
// ======================================================

export const {
  useGetBookingsQuery,
  useLazyGetBookingsQuery,
  useGetBookingStatsQuery,
  useLazyGetBookingStatsQuery,
  useCheckAvailabilityQuery,
  useLazyCheckAvailabilityQuery,
  useGetBookingQuery,
  useLazyGetBookingQuery,
  useCreateBookingMutation,
  useUpdateBookingMutation,
  useExtendBookingMutation,
  useCancelBookingMutation,
} = bookingApi;