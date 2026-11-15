import { baseApi, clean } from "./baseApi";
import { mapBooking, payMethod, unwrap } from "./bookingApi";

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

export const carApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCars: builder.query({
      query: (params = {}) => ({
        url: "/cars",
        params: mapCarParams(params),
      }),
      transformResponse: (res) => {
        const body = unwrap(res) || {};
        const items = (body.items || []).map(mapCar);
        const p = body.pagination || {};
        return {
          items,
          pagination: p,
          page: p.page ?? 1,
          pageSize: p.limit ?? items.length,
          total: p.total ?? items.length,
          totalPages: p.totalPages ?? 1,
        };
      },
      providesTags: ["Cars"],
    }),

    // Cards on the Cars page and the status chips on New Booking.
    getCarStats: builder.query({
      query: () => "/cars/stats",
      transformResponse: (res) => {
        const s = unwrap(res) || {};
        const n = (...v) => Number(v.find((x) => x !== undefined && x !== null) ?? 0);
        return {
          ...s,
          total: n(s.totalCars, s.total),
          available: n(s.availableCars, s.available),
          booked: n(s.bookedCars, s.booked),
          onRent: n(s.onRentCars, s.on_rent),
          repair: n(s.underRepairCars, s.maintenance),
          outOfService: n(s.out_of_service),
        };
      },
      providesTags: ["Cars", "Dashboard"],
    }),

    getCarReminders: builder.query({
      query: (params = {}) => ({
        url: "/cars/reminders",
        params: clean(params),
      }),
      providesTags: ["Cars", "Reminders"],
    }),

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

    // 1) JSON only. Photos / documents are separate multipart calls.
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

    deleteCar: builder.mutation({
      query: (id) => ({
        url: `/cars/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: CAR_TAGS,
    }),

    // multipart, field name: images
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

    removeCarImage: builder.mutation({
      query: ({ id, url }) => ({
        url: `/cars/${id}/images`,
        method: "DELETE",
        body: { url },
      }),
      invalidatesTags: ["Cars", "Documents"],
    }),

    // multipart, fields: file + type (registration | insurance | token)
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
      invalidatesTags: CAR_TAGS,
    }),

    getCarHistory: builder.query({
      query: (id) => `/cars/${id}/history`,
      providesTags: ["Cars", "Bookings", "Inspections"],
    }),

    getCarFinancials: builder.query({
      query: (id) => `/cars/${id}/financials`,
      providesTags: ["Cars", "Payments", "Expenses", "Reports", "Profits"],
    }),

    checkCarAvailability: builder.query({
      query: ({ id, ...params }) => ({
        url: `/cars/${id}/availability`,
        params: clean(params),
      }),
      providesTags: ["Cars", "Bookings"],
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

    // Creates an Expense on the backend and moves next service / oil change date.
    addServiceRecord: builder.mutation({
      query: ({ id, ...body }) => {
        const payload = {
          category: slug(body.category), // "Service" → "service", "Oil Change" → "oil_change"
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