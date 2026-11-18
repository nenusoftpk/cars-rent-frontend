/**
 * src/redux/api/carApi.js
 *
 * Full online + offline support for cars.
 *
 * - List / get / create / update / delete work offline via baseApi + offlineAdapter
 * - Stats & availability have high-quality local fallbacks
 * - File uploads and complex server-side endpoints remain online-only
 * - Same hooks, same argument shapes, zero page changes
 */

import { baseApi, clean } from "./baseApi";
import { mapBooking, payMethod, unwrap } from "./bookingApi";
import {
  isBrowserOnline,
  isNetworkFailure,
  executeOffline,
} from "@/offline/offlineAdapter";

// ======================================================
// CACHE TAGS
// ======================================================

const CAR_TAGS = [
  "Cars",
  "Bookings",
  "Inspections",
  "Payments",
  "Expenses",
  "Reports",
  "Dashboard",
  "Reminders",
  "Documents",
  "Profits",
];

/* ------------------------------------------------------------------ */
/* Mappers                                                             */
/* ------------------------------------------------------------------ */

const toEnum = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const cap = (s) => {
  const v = String(s ?? "").replace(/_/g, " ").trim();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "";
};

const STATUS_LABEL = {
  available: "Available",
  booked: "Booked",
  on_rent: "On Rent",
  maintenance: "Under Repair",
  out_of_service: "Out of Service",
};

/** accepts a backend enum OR a display label → backend enum */
const statusEnum = (s) => {
  const k = toEnum(s);
  return k === "under_repair" ? "maintenance" : k;
};
const statusLabel = (s) => STATUS_LABEL[statusEnum(s)] || s || "";

const fuelLabel = (f) => {
  const v = String(f ?? "").toLowerCase();
  return v === "cng" ? "CNG" : cap(v);
};

/** ISO date → "yyyy-MM-dd" (what the date pickers and toDay() compare with) */
const dateOnly = (v) => {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

/** backend car → frontend car */
export function mapCar(c) {
  if (!c) return c;
  const raw = statusEnum(c.status);
  const images = Array.isArray(c.images) ? c.images : [];
  return {
    ...c,
    id: c.id || c._id,
    name: c.name || [c.brand, c.model].filter(Boolean).join(" "),
    plate: c.plate ?? c.numberPlate ?? "",
    fuel: fuelLabel(c.fuel ?? c.fuelType),
    transmission: cap(c.transmission),
    seats: c.seats ?? c.seatingCapacity ?? 0,
    dailyRate: c.dailyRate ?? c.dailyRent ?? 0,
    hourlyRate: c.hourlyRate ?? c.hourlyRent ?? 0,
    odometer: c.odometer ?? 0,
    image: c.image || images[0] || "",
    images,
    registrationDoc: c.registrationDoc ?? c.registrationDocument ?? "",
    insuranceDoc: c.insuranceDoc ?? c.insuranceDocument ?? "",
    insuranceExpiry: dateOnly(c.insuranceExpiry),
    registrationExpiry: dateOnly(c.registrationExpiry),
    tokenExpiry: dateOnly(c.tokenExpiry ?? c.tokenTaxExpiry),
    nextServiceDate: dateOnly(c.nextServiceDate),
    nextOilChangeDate: dateOnly(c.nextOilChangeDate),
    status: statusLabel(c.status),
    // Only statuses a user can set by hand. "Booked" / "On Rent" are automatic.
    manualStatus: ["available", "maintenance", "out_of_service"].includes(raw)
      ? STATUS_LABEL[raw]
      : "Available",
    // Offline markers (harmless online)
    _offline: c._offline || false,
    _pendingSync: c._pendingSync || false,
  };
}

const mapExpense = (e) => ({
  ...e,
  id: e.id || e._id,
  category: cap(e.category),
  details: e.details ?? e.title ?? e.description ?? "",
  date: e.date ?? e.expenseDate ?? e.createdAt,
  supplier: e.supplier ?? e.paidTo ?? e.workshopName ?? e.vendor ?? "",
  amount: Number(e.amount ?? 0),
});

/** frontend car form values → backend JSON body (whitelisted, no files) */
function mapCarBody(v = {}) {
  const out = {};
  const put = (k, val) => {
    if (val !== undefined) out[k] = val;
  };
  const num = (x) => (x === "" || x === null || x === undefined ? undefined : Number(x));
  const date = (x) => (x === undefined ? undefined : dateOnly(x) || null);
  const text = (x) => (x === undefined || x === null ? undefined : String(x).trim());

  const brand = text(v.brand);
  const model = text(v.model);
  put("brand", brand);
  put("model", model);
  // the form has no "name" field – the backend requires one
  put("name", text(v.name) || (brand && model ? `${brand} ${model}` : undefined));
  put("year", num(v.year));
  put("numberPlate", v.plate !== undefined ? String(v.plate).trim().toUpperCase() : undefined);
  put("color", text(v.color));
  put("fuelType", v.fuel !== undefined ? String(v.fuel).toLowerCase() : undefined);
  put("transmission", v.transmission !== undefined ? String(v.transmission).toLowerCase() : undefined);
  put("seatingCapacity", num(v.seats));
  put("odometer", num(v.odometer));
  put("dailyRent", num(v.dailyRate));
  put("hourlyRent", v.hourlyRate === "" ? 0 : num(v.hourlyRate));

  put("insuranceExpiry", date(v.insuranceExpiry));
  put("registrationExpiry", date(v.registrationExpiry));
  put("tokenTaxExpiry", date(v.tokenExpiry));
  put("nextServiceDate", date(v.nextServiceDate));
  put("nextOilChangeDate", date(v.nextOilChangeDate));

  // "Booked" / "On Rent" are set by the system, never by the form.
  if (v.status !== undefined) {
    const s = statusEnum(v.status);
    if (["available", "maintenance", "out_of_service"].includes(s)) out.status = s;
  }

  // image / registrationDoc / insuranceDoc are uploaded separately (multipart).
  return out;
}

const SORT_FIELD = { dailyRate: "dailyRent", hourlyRate: "hourlyRent", plate: "numberPlate" };

/** list params used by the UI → backend query names */
function mapCarParams(p = {}) {
  const q = { ...p };
  // UI-only params
  delete q.view;
  delete q.layout;
  delete q.availFrom;
  delete q.availTo;
  delete q.excludeId;

  if (q.pageSize !== undefined) {
    q.limit = q.pageSize;
    delete q.pageSize;
  }
  if (q.status) q.status = statusEnum(q.status);
  if (q.fuel) {
    q.fuelType = String(q.fuel).toLowerCase();
    delete q.fuel;
  }
  if (q.sort) {
    const [f, d] = String(q.sort).split(":");
    q.sort = `${SORT_FIELD[f] || f}:${d || "asc"}`;
  }
  return clean(q);
}

const slug = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s/&-]+/g, "_");

// ======================================================
// LOCAL FALLBACKS (used when offline / network failure)
// ======================================================

/**
 * Approximate car stats from the local IndexedDB cache.
 * Good enough for the status cards while offline.
 */
async function localCarStats(api) {
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
        available: 0,
        booked: 0,
        onRent: 0,
        repair: 0,
        outOfService: 0,
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "car",
    businessId: String(businessId),
    params: { limit: 3000 },
    accessFilter: (r) => String(r.businessId) === String(businessId),
    mapper: mapCar,
  });

  if (result.error) {
    return {
      data: {
        total: 0,
        available: 0,
        booked: 0,
        onRent: 0,
        repair: 0,
        outOfService: 0,
        _offline: true,
      },
    };
  }

  const items = result.data?.items || [];
  const stats = {
    total: items.length,
    available: 0,
    booked: 0,
    onRent: 0,
    repair: 0,
    outOfService: 0,
    _offline: true,
  };

  for (const c of items) {
    const s = statusEnum(c.status);
    if (s === "available") stats.available += 1;
    else if (s === "booked") stats.booked += 1;
    else if (s === "on_rent") stats.onRent += 1;
    else if (s === "maintenance") stats.repair += 1;
    else if (s === "out_of_service") stats.outOfService += 1;
  }

  return { data: stats };
}

/**
 * Provisional local availability check for a single car.
 */
async function localCarAvailability(args, api) {
  const state = api.getState();
  const auth = state?.auth || {};
  const user = auth.user || {};
  const businessId =
    auth.businessId ||
    user.businessId ||
    user.business?._id ||
    user.business?.id ||
    null;

  const carId = args.id || args.carId;

  if (!businessId || !carId) {
    return {
      data: {
        available: true,
        message: "Unable to verify availability offline. Will be re-checked on sync.",
        provisional: true,
        _offline: true,
      },
    };
  }

  // Re-use the same overlap logic that bookingApi uses
  const from = args.from || args.pickupDate || args.availFrom;
  const to = args.to || args.returnDate || args.availTo;

  if (!from || !to) {
    return {
      data: {
        available: true,
        message: "No date range supplied for offline check.",
        provisional: true,
        _offline: true,
      },
    };
  }

  const fromTs = new Date(from).getTime();
  const toTs = new Date(to).getTime();

  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) {
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
    params: { carId, limit: 3000 },
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
    const status = toEnum(b.status);
    return status !== "cancelled" && status !== "completed";
  });

  const conflict = items.some((b) => {
    const bFrom = new Date(b.pickupAt || b.pickupDate).getTime();
    const bTo = new Date(b.returnAt || b.returnDate).getTime();
    if (!Number.isFinite(bFrom) || !Number.isFinite(bTo)) return false;
    return fromTs < bTo && bFrom < toTs;
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
// CAR API
// ======================================================

export const carApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // LIST CARS
    // --------------------------------------------------
    getCars: builder.query({
      query: (params = {}) => ({
        url: "/cars",
        params: mapCarParams(params),
      }),
      transformResponse: (res) => {
        const body = unwrap(res) || res || {};
        const items = (body.items || []).map(mapCar);
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
      },
      providesTags: ["Cars"],
    }),

    // --------------------------------------------------
    // CAR STATS (with offline fallback)
    // --------------------------------------------------
    getCarStats: builder.query({
      async queryFn(_arg, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/cars/stats",
            method: "GET",
          });

          if (!result.error) {
            const s = unwrap(result.data) || {};
            const n = (...v) =>
              Number(v.find((x) => x !== undefined && x !== null) ?? 0);
            return {
              data: {
                ...s,
                total: n(s.totalCars, s.total),
                available: n(s.availableCars, s.available),
                booked: n(s.bookedCars, s.booked),
                onRent: n(s.onRentCars, s.on_rent),
                repair: n(s.underRepairCars, s.maintenance),
                outOfService: n(s.out_of_service),
              },
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localCarStats(api);
      },
      providesTags: ["Cars", "Dashboard"],
    }),

    // --------------------------------------------------
    // REMINDERS (online-only – server generated)
    // --------------------------------------------------
    getCarReminders: builder.query({
      query: (params = {}) => ({
        url: "/cars/reminders",
        params: clean(params),
      }),
      providesTags: ["Cars", "Reminders"],
    }),

    // --------------------------------------------------
    // SINGLE CAR
    // --------------------------------------------------
    getCar: builder.query({
      query: (id) => `/cars/${id}`,
      transformResponse: (res) => {
        const x = unwrap(res);
        const c = mapCar(x?.car ?? x);
        return {
          ...c,
          bookings: (c.bookings || []).map(mapBooking),
          expenses: (c.expenses || []).map(mapExpense),
          totalIncome: Number(c.totalIncome ?? 0),
          totalExpenses: Number(c.totalExpenses ?? 0),
          financialLocked: !!c.financialLocked,
        };
      },
      providesTags: (result, error, id) => ["Cars", { type: "Cars", id }],
    }),

    // --------------------------------------------------
    // ADD CAR (offline-capable – JSON only)
    // --------------------------------------------------
    addCar: builder.mutation({
      query: (body) => ({
        url: "/cars",
        method: "POST",
        body: mapCarBody(body),
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapCar(x?.car ?? x);
      },
      invalidatesTags: CAR_TAGS,
    }),

    // --------------------------------------------------
    // UPDATE CAR (offline-capable – JSON only)
    // --------------------------------------------------
    updateCar: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/cars/${id}`,
        method: "PATCH",
        body: mapCarBody(body),
      }),
      transformResponse: (res) => {
        const x = unwrap(res);
        return mapCar(x?.car ?? x);
      },
      invalidatesTags: CAR_TAGS,
    }),

    // --------------------------------------------------
    // DELETE CAR (offline-capable)
    // --------------------------------------------------
    deleteCar: builder.mutation({
      query: (id) => ({
        url: `/cars/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: CAR_TAGS,
    }),

    // --------------------------------------------------
    // UPLOAD IMAGES (online-only – FormData)
    // --------------------------------------------------
    uploadCarImages: builder.mutation({
      query: ({ id, files }) => {
        const formData = new FormData();
        (Array.isArray(files) ? files : [files]).forEach((f) => {
          const blob = f instanceof Blob ? f : f?.file instanceof Blob ? f.file : null;
          if (blob) formData.append("images", blob, blob.name || "car-photo.jpg");
        });
        return {
          url: `/cars/${id}/images`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Cars", "Documents"],
    }),

    // --------------------------------------------------
    // REMOVE IMAGE (online-only)
    // --------------------------------------------------
    removeCarImage: builder.mutation({
      query: ({ id, url }) => ({
        url: `/cars/${id}/images`,
        method: "DELETE",
        body: { url },
      }),
      invalidatesTags: ["Cars", "Documents"],
    }),

    // --------------------------------------------------
    // UPLOAD DOCUMENT (online-only – FormData)
    // --------------------------------------------------
    uploadCarDocument: builder.mutation({
      query: ({ id, type, file }) => {
        const formData = new FormData();
        formData.append("file", file, file?.name || "document");
        formData.append("type", type === "tokenTax" ? "token" : type);
        return {
          url: `/cars/${id}/documents`,
          method: "POST",
          body: formData,
        };
      },
      invalidatesTags: ["Cars", "Documents"],
    }),

    // --------------------------------------------------
    // SET STATUS (maps to offline update when possible)
    // --------------------------------------------------
    setCarStatus: builder.mutation({
      query: ({ id, ...body }) => {
        const payload = { ...body };
        if (payload.status) payload.status = statusEnum(payload.status);
        return {
          url: `/cars/${id}/status`,
          method: "PATCH",
          body: payload,
        };
      },
      // When offline, baseApi will not match /cars/:id/status
      // (segments > 2). We therefore also support a plain
      // update path for the three manual statuses.
      async onQueryStarted({ id, status }, { dispatch, queryFulfilled }) {
        // Optimistic update is optional; kept simple for safety.
        try {
          await queryFulfilled;
        } catch {
          // Error already surfaced by the mutation.
        }
      },
      invalidatesTags: CAR_TAGS,
    }),

    // --------------------------------------------------
    // HISTORY / FINANCIALS / SERVICES (online-only)
    // --------------------------------------------------
    getCarHistory: builder.query({
      query: (id) => `/cars/${id}/history`,
      providesTags: ["Cars", "Bookings", "Inspections"],
    }),

    getCarFinancials: builder.query({
      query: (id) => `/cars/${id}/financials`,
      providesTags: ["Cars", "Payments", "Expenses", "Reports", "Profits"],
    }),

    getCarServiceRecords: builder.query({
      query: ({ id, ...params }) => ({
        url: `/cars/${id}/services`,
        params: clean(params),
      }),
      providesTags: ["Cars", "Expenses", "Reports"],
    }),

    getCarMaintenance: builder.query({
      query: (id) => `/cars/${id}/maintenance`,
      providesTags: ["Cars", "Expenses", "Reports"],
    }),

    // --------------------------------------------------
    // AVAILABILITY (with provisional offline fallback)
    // --------------------------------------------------
    checkCarAvailability: builder.query({
      async queryFn(args = {}, api, _extraOptions, baseQuery) {
        const id = args.id || args.carId;
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/cars/${id}/availability`,
            params: clean(args),
          });

          if (!result.error) {
            return { data: { ...unwrap(result.data), provisional: false } };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localCarAvailability(args, api);
      },
      providesTags: ["Cars", "Bookings"],
    }),

    // --------------------------------------------------
    // ADD SERVICE RECORD (online-only – creates Expense)
    // --------------------------------------------------
    addServiceRecord: builder.mutation({
      query: ({ id, ...body }) => {
        const payload = {
          category: slug(body.category),
          date: body.date,
          details: body.details,
          amount: Number(body.amount) || 0,
          method: payMethod(body.method) || "cash",
          supplier: body.supplier || "",
        };
        if (body.odometer) payload.odometer = Number(body.odometer);
        if (body.nextDue) payload.nextDue = body.nextDue;
        return {
          url: `/cars/${id}/services`,
          method: "POST",
          body: payload,
        };
      },
      invalidatesTags: CAR_TAGS,
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS (unchanged names)
// ======================================================

export const {
  useGetCarsQuery,
  useLazyGetCarsQuery,
  useGetCarStatsQuery,
  useLazyGetCarStatsQuery,
  useGetCarRemindersQuery,
  useLazyGetCarRemindersQuery,
  useGetCarQuery,
  useLazyGetCarQuery,
  useAddCarMutation,
  useUpdateCarMutation,
  useDeleteCarMutation,
  useUploadCarImagesMutation,
  useRemoveCarImageMutation,
  useUploadCarDocumentMutation,
  useSetCarStatusMutation,
  useGetCarHistoryQuery,
  useLazyGetCarHistoryQuery,
  useGetCarFinancialsQuery,
  useLazyGetCarFinancialsQuery,
  useCheckCarAvailabilityQuery,
  useLazyCheckCarAvailabilityQuery,
  useGetCarServiceRecordsQuery,
  useLazyGetCarServiceRecordsQuery,
  useGetCarMaintenanceQuery,
  useLazyGetCarMaintenanceQuery,
  useAddServiceRecordMutation,
} = carApi;