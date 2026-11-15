import { baseApi, clean } from "./baseApi";
import { PAYMENT_METHODS } from "@/constants";

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
 * employeeId, from, to  (sorting is always createdAt desc, `from`/`to` filter the
 * PICK-UP date). Sending anything else is rejected with 400 by the query validator.
 * After you add sort / dateField / view support to listBookings (and to
 * bookingFilterSchema) set this to true and the extra params are sent too.
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

/** UI payment-method label → backend enum (cash|bank|jazzcash|easypaisa|card|other) */
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

/** backend method enum → the label used by PAYMENT_METHODS (METHOD_ICON keys) */
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

/** backend payment (list row, booking.payments[] or create response) → UI shape */
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

/** backend inspection (issue / return) → shape the UI expects */
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
 * GET /bookings, GET /bookings/:id and create/update/extend/cancel already return the
 * UI shape (number, invoiceNo, customerName, pickupAt, total, paid, balance, status
 * label, charges, issue, returnInfo, deposit*, payments). This only fills gaps, so it
 * also works for the raw booking rows embedded in GET /cars/:id.
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

  // advance / deposit RECEIPTS are separate calls to /payments (see paymentApi);
  // charges[], method and requestId are not booking fields.
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

  if (status === "overdue") status = "on_rent"; // filtered to late ones in transformResponse
  if (view && VIEW_STATUS[view] && !status) status = VIEW_STATUS[view];
  if (view === "upcoming") {
    if (!status) status = "reserved";
    if (!from) from = new Date().toISOString().slice(0, 10); // pick-up from today on
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

/** the backend sorts by createdAt desc only, so sort the rows of the page here */
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

/** { items, pagination } → { items, pagination, page, pageSize, total, totalPages } */
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

export const bookingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBookings: builder.query({
      query: (params = {}) => ({
        url: "/bookings",
        method: "GET",
        params: mapBookingParams(params),
      }),
      transformResponse: (res, _meta, arg = {}) => {
        const body = unwrap(res) || {};
        let items = (body.items || []).map(mapBooking);
        if (arg.view === "overdue" || toEnum(arg.status) === "overdue") {
          items = items.filter((b) => b.isOverdue);
        }
        if (!SERVER_LIST_EXTRAS) items = sortItems(items, arg.sort);
        return flatten(body, items);
      },
      providesTags: ["Bookings", "Payments"],
    }),

    // GET /bookings/stats → { total, reserved, onRent, completed, cancelled, ... }
    // Tab counts for All Bookings (upcoming / overdue have no count on the server).
    getBookingStats: builder.query({
      query: () => ({
        url: "/bookings/stats",
        method: "GET",
      }),
      transformResponse: (res) => {
        const s = unwrap(res) || {};
        return {
          ...s,
          all: s.total,
          reserved: s.reserved,
          active: s.onRent,
          completed: s.completed,
          cancelled: s.cancelled,
        };
      },
      providesTags: ["Bookings", "Dashboard"],
    }),

    // UI args { carId, from, to, excludeId } → ?carId=&pickupDate=&returnDate=&excludeBookingId=
    // Backend answer: { available, reason }
    checkAvailability: builder.query({
      query: (args = {}) => ({
        url: "/bookings/availability",
        method: "GET",
        params: clean({
          carId: args.carId,
          pickupDate: toIso(args.from ?? args.pickupDate),
          returnDate: toIso(args.to ?? args.returnDate),
          excludeBookingId: args.excludeId ?? args.excludeBookingId,
        }),
      }),
      transformResponse: (res) => {
        const x = unwrap(res) || {};
        return {
          ...x,
          available: x.available !== false,
          message: x.message || x.reason || "This car is already booked for these dates.",
        };
      },
      providesTags: ["Bookings", "Cars"],
    }),

    getBooking: builder.query({
      query: (id) => ({
        url: `/bookings/${id}`,
        method: "GET",
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapBooking(x?.booking ?? x);
      },
      providesTags: (result, error, id) => [{ type: "Bookings", id }, "Bookings", "Payments"],
    }),

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

    // UI sends { id, returnAt } → backend { returnDate }
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

    // The server only accepts { reason }. It refuses to cancel while rental money or a
    // security deposit is still held, so refunds must be recorded first (Billing).
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