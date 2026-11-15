import { baseApi, clean } from "./baseApi";
import { mapBooking, mapInspection, unwrap } from "./bookingApi";

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
const asFile = (p) => (p instanceof File ? p : p?.file instanceof File ? p.file : null);

/**
 * Build multipart FormData for POST /inspections/issue and /inspections/return.
 * Accepts the UI names (meter / fuel / damage / damageCharge) or the backend names.
 */
function toInspectionFormData(body = {}) {
  const fd = new FormData();
  const add = (key, value) => {
    if (value !== undefined && value !== null && value !== "") fd.append(key, String(value));
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
  // issue → { bookingId, status, issue }   return → { bookingId, status, totalAmount, lateCharges, returnInfo }
  const rawInspection =
    x.issue ?? x.returnInfo ?? x.inspection ?? (x.meterReading !== undefined || x.fuelLevel !== undefined ? x : null);
  return {
    booking: x.booking ? mapBooking(x.booking) : null,
    inspection: mapInspection(rawInspection),
    bookingId: x.bookingId || arg?.bookingId,
    total: x.totalAmount, // return only: final bill after late / km / damage charges
  };
}

export const carInspectionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listInspections: builder.query({
      query: (params = {}) => ({
        url: "/inspections",
        params: clean(params),
      }),
      providesTags: ["Inspections", "Bookings"],
    }),

    getInspectionStats: builder.query({
      query: () => "/inspections/stats",
      providesTags: ["Inspections", "Dashboard"],
    }),

    issueCar: builder.mutation({
      query: (body) => ({
        url: "/inspections/issue",
        method: "POST",
        body: toInspectionFormData(body),
      }),
      transformResponse: transformInspectionResponse,
      invalidatesTags: INSPECTION_TAGS,
    }),

    returnCar: builder.mutation({
      query: (body) => ({
        url: "/inspections/return",
        method: "POST",
        body: toInspectionFormData(body),
      }),
      transformResponse: transformInspectionResponse,
      invalidatesTags: INSPECTION_TAGS,
    }),

    getBookingInspections: builder.query({
      query: (bookingId) => `/inspections/booking/${bookingId}`,
      providesTags: ["Inspections", "Bookings"],
    }),

    getInspection: builder.query({
      query: ({ bookingId, type }) => `/inspections/booking/${bookingId}/${type}`,
      transformResponse: (res) => mapInspection(unwrap(res)?.inspection ?? unwrap(res)),
      providesTags: ["Inspections", "Bookings"],
    }),

    getInspectionById: builder.query({
      query: (id) => `/inspections/${id}`,
      transformResponse: (res) => mapInspection(unwrap(res)?.inspection ?? unwrap(res)),
      providesTags: ["Inspections"],
    }),
  }),

  overrideExisting: false,
});

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