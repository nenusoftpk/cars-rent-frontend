/**
 * src/redux/api/carInspectionApi.js
 *
 * Online + offline support for car inspections.
 *
 * - All read endpoints work offline via IndexedDB
 * - issueCar / returnCar remain online-only (multipart + side-effects)
 * - Same hooks, same argument shapes, zero page changes
 */

import { baseApi, clean } from "./baseApi";
import { mapBooking, mapInspection, unwrap } from "./bookingApi";
import {
  isBrowserOnline,
  isNetworkFailure,
  executeOffline,
} from "@/offline/offlineAdapter";

// ======================================================
// CACHE TAGS
// ======================================================

const INSPECTION_TAGS = [
  "Inspections",
  "Bookings",
  "Cars",
  "Payments",
  "Expenses",
  "Reports",
  "Dashboard",
  "Reminders",
  "Documents",
  "Profits",
];

const MAX_PHOTOS = 5;

/** FormPhotoUpload may hold File objects or { file } wrappers – keep real Files only */
const asFile = (p) =>
  p instanceof File ? p : p?.file instanceof File ? p.file : null;

/**
 * Build multipart FormData for POST /inspections/issue and /inspections/return.
 * Accepts the UI names (meter / fuel / damage / damageCharge) or the backend names.
 */
function toInspectionFormData(body = {}) {
  const fd = new FormData();
  const add = (key, value) => {
    if (value !== undefined && value !== null && value !== "") {
      fd.append(key, String(value));
    }
  };

  add("bookingId", body.bookingId);
  add("meterReading", body.meterReading ?? body.meter);
  add("fuelLevel", body.fuelLevel ?? body.fuel);
  add("damageNotes", body.damageNotes ?? body.damage);
  add("notes", body.notes);
  add("condition", body.condition);

  // return-only charges (0 is a valid value, so only skip empty)
  add("damageCharges", body.damageCharges ?? body.damageCharge);
  add("extraKmCharges", body.extraKmCharges);
  add("lateCharges", body.lateCharges);
  add("fuelCharges", body.fuelCharges);
  add("extraDayCharges", body.extraDayCharges);

  add("markUnderRepair", body.markUnderRepair);
  add("repairReason", body.repairReason);
  add("expectedRepairCompletionDate", body.expectedRepairCompletionDate);

  const photos = body.photos ?? body.files ?? [];
  (Array.isArray(photos) ? photos : [photos])
    .map(asFile)
    .filter(Boolean)
    .slice(0, MAX_PHOTOS)
    .forEach((f) => fd.append("photos", f));

  return fd;
}

/**
 * Normalised mutation result: { booking, inspection, bookingId }.
 * `booking` is present only if the backend returns the updated booking.
 */
function transformInspectionResponse(res, _meta, arg) {
  const x = unwrap(res) || {};
  // issue → { bookingId, status, issue }
  // return → { bookingId, status, totalAmount, lateCharges, returnInfo }
  const rawInspection =
    x.issue ??
    x.returnInfo ??
    x.inspection ??
    (x.meterReading !== undefined || x.fuelLevel !== undefined ? x : null);

  return {
    booking: x.booking ? mapBooking(x.booking) : null,
    inspection: mapInspection(rawInspection),
    bookingId: x.bookingId || arg?.bookingId,
    total: x.totalAmount, // return only: final bill after late / km / damage charges
  };
}

// ======================================================
// LOCAL FALLBACKS
// ======================================================

/**
 * Approximate inspection stats from the local IndexedDB cache.
 */
async function localInspectionStats(api) {
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
        issue: 0,
        return: 0,
        _offline: true,
      },
    };
  }

  const result = await executeOffline({
    action: "list",
    entity: "inspection",
    businessId: String(businessId),
    params: { limit: 3000 },
    accessFilter: (r) => String(r.businessId) === String(businessId),
    mapper: mapInspection,
  });

  if (result.error) {
    return {
      data: {
        total: 0,
        issue: 0,
        return: 0,
        _offline: true,
      },
    };
  }

  const items = result.data?.items || [];
  let issue = 0;
  let ret = 0;

  for (const i of items) {
    const t = String(i.type || "").toLowerCase();
    if (t === "issue" || t === "checkout") issue += 1;
    else if (t === "return" || t === "checkin") ret += 1;
  }

  return {
    data: {
      total: items.length,
      issue,
      return: ret,
      _offline: true,
    },
  };
}

/**
 * Helper to run a list query against IndexedDB for inspections.
 */
async function localInspectionList(params, api) {
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
    entity: "inspection",
    businessId: String(businessId),
    params: {
      ...params,
      limit: params.limit ?? params.pageSize ?? 50,
    },
    accessFilter: (r) => String(r.businessId) === String(businessId),
    mapper: mapInspection,
  });
}

// ======================================================
// INSPECTION API
// ======================================================

export const carInspectionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // LIST INSPECTIONS (offline-capable)
    // --------------------------------------------------
    listInspections: builder.query({
      async queryFn(params = {}, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/inspections",
            params: clean(params),
          });

          if (!result.error) {
            const body = unwrap(result.data) || result.data || {};
            const items = (body.items || body || []).map(mapInspection);
            const p = body.pagination || {};
            return {
              data: {
                items,
                pagination: p,
                page: body.page ?? p.page ?? 1,
                pageSize: body.pageSize ?? p.limit ?? items.length,
                total: body.total ?? p.total ?? items.length,
                totalPages: body.totalPages ?? p.totalPages ?? 1,
              },
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline / network error → local list
        return localInspectionList(params, api);
      },
      providesTags: ["Inspections", "Bookings"],
    }),

    // --------------------------------------------------
    // INSPECTION STATS (with offline fallback)
    // --------------------------------------------------
    getInspectionStats: builder.query({
      async queryFn(_arg, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/inspections/stats",
            method: "GET",
          });

          if (!result.error) {
            return { data: unwrap(result.data) || result.data };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        return localInspectionStats(api);
      },
      providesTags: ["Inspections", "Dashboard"],
    }),

    // --------------------------------------------------
    // ISSUE CAR (online-only – multipart + side-effects)
    // --------------------------------------------------
    issueCar: builder.mutation({
      query: (body) => ({
        url: "/inspections/issue",
        method: "POST",
        body: toInspectionFormData(body),
      }),
      transformResponse: transformInspectionResponse,
      invalidatesTags: INSPECTION_TAGS,
    }),

    // --------------------------------------------------
    // RETURN CAR (online-only – multipart + side-effects)
    // --------------------------------------------------
    returnCar: builder.mutation({
      query: (body) => ({
        url: "/inspections/return",
        method: "POST",
        body: toInspectionFormData(body),
      }),
      transformResponse: transformInspectionResponse,
      invalidatesTags: INSPECTION_TAGS,
    }),

    // --------------------------------------------------
    // INSPECTIONS FOR A BOOKING (offline-capable)
    // --------------------------------------------------
    getBookingInspections: builder.query({
      async queryFn(bookingId, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/inspections/booking/${bookingId}`,
          });

          if (!result.error) {
            const body = unwrap(result.data) || result.data;
            // Backend may return array or { items: [...] }
            const list = Array.isArray(body)
              ? body
              : body?.items || body?.inspections || [];
            return {
              data: list.map(mapInspection),
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline fallback – filter local inspections by bookingId
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
          return { data: [] };
        }

        const result = await executeOffline({
          action: "list",
          entity: "inspection",
          businessId: String(businessId),
          params: { bookingId, limit: 50 },
          accessFilter: (r) => String(r.businessId) === String(businessId),
          mapper: mapInspection,
        });

        if (result.error) return { data: [] };

        return {
          data: (result.data?.items || []).filter(
            (i) => String(i.bookingId) === String(bookingId)
          ),
        };
      },
      providesTags: ["Inspections", "Bookings"],
    }),

    // --------------------------------------------------
    // SINGLE INSPECTION BY BOOKING + TYPE (offline-capable)
    // --------------------------------------------------
    getInspection: builder.query({
      async queryFn({ bookingId, type }, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/inspections/booking/${bookingId}/${type}`,
          });

          if (!result.error) {
            const raw = unwrap(result.data);
            return {
              data: mapInspection(raw?.inspection ?? raw),
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline fallback
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
          return { data: null };
        }

        const result = await executeOffline({
          action: "list",
          entity: "inspection",
          businessId: String(businessId),
          params: { bookingId, limit: 20 },
          accessFilter: (r) => String(r.businessId) === String(businessId),
          mapper: mapInspection,
        });

        if (result.error) return { data: null };

        const match = (result.data?.items || []).find((i) => {
          const t = String(i.type || "").toLowerCase();
          return (
            String(i.bookingId) === String(bookingId) &&
            (t === String(type).toLowerCase() ||
              (type === "issue" && (t === "checkout" || t === "issue")) ||
              (type === "return" && (t === "checkin" || t === "return")))
          );
        });

        return { data: match || null };
      },
      providesTags: ["Inspections", "Bookings"],
    }),

    // --------------------------------------------------
    // SINGLE INSPECTION BY ID (offline-capable)
    // --------------------------------------------------
    getInspectionById: builder.query({
      async queryFn(id, api, _extraOptions, baseQuery) {
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/inspections/${id}`,
          });

          if (!result.error) {
            const raw = unwrap(result.data);
            return {
              data: mapInspection(raw?.inspection ?? raw),
            };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        // Offline fallback
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
          return { data: null };
        }

        const result = await executeOffline({
          action: "get",
          entity: "inspection",
          businessId: String(businessId),
          id,
          accessFilter: (r) => String(r.businessId) === String(businessId),
          mapper: mapInspection,
        });

        if (result.error) return { data: null };
        return { data: result.data };
      },
      providesTags: ["Inspections"],
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS (unchanged names)
// ======================================================

export const {
  useListInspectionsQuery,
  useLazyListInspectionsQuery,
  useGetInspectionStatsQuery,
  useLazyGetInspectionStatsQuery,
  useIssueCarMutation,
  useReturnCarMutation,
  useGetBookingInspectionsQuery,
  useLazyGetBookingInspectionsQuery,
  useGetInspectionQuery,
  useLazyGetInspectionQuery,
  useGetInspectionByIdQuery,
  useLazyGetInspectionByIdQuery,
} = carInspectionApi;