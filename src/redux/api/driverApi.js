// PATH: src/redux/api/driverApi.js   (REPLACE your existing file)
import { baseApi, clean } from './baseApi';
import { mapBooking, unwrap } from './bookingApi';

// ------------------------------------------------------------------
// Shared helpers
// ------------------------------------------------------------------
const withId = (d) => (d && typeof d === 'object' ? { ...d, id: d.id ?? d._id } : d);

const toList = (res, map = withId) => {
  const body = unwrap(res) || {};
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
    };
  }

  const items = (body.items || []).map((r, i) => map(r, i));
  const p = body.pagination || {};
  return {
    items,
    pagination: p,
    page: p.page ?? 1,
    pageSize: p.limit ?? items.length,
    total: p.total ?? items.length,
    totalPages: p.totalPages ?? 1,
    summary: body.summary,
    driver: body.driver ? withId(body.driver) : undefined,
  };
};

const DRIVER_TAGS = [
  'Drivers',
  'Bookings',
  'Expenses',
  'Payments',
  'Dashboard',
  'Reports',
  'Profits',
  'Reminders',
];

// ------------------------------------------------------------------
// Driver body → multipart FormData
// Backend (driverValidation + Multer): text fields in the body,
// images as files: photo, cnicFront, cnicBack, licenseImage.
// Existing Cloudinary URLs are never re-sent – the backend keeps them.
// ------------------------------------------------------------------
const REQUIRED_TEXT = ['name', 'phone'];
const CLEARABLE_TEXT = ['email', 'address', 'cnic', 'licenseNumber', 'licenseExpiry'];
const NUMBER_FIELDS = ['salary', 'paymentRate'];
const ENUM_FIELDS = ['paymentType', 'status'];
const IMAGE_FIELDS = ['photo', 'cnicFront', 'cnicBack', 'licenseImage'];

function toDriverFormData(body = {}) {
  const fd = new FormData();
  const has = (v) => v !== undefined && v !== null && v !== '';

  for (const k of [...REQUIRED_TEXT, ...NUMBER_FIELDS, ...ENUM_FIELDS]) {
    if (has(body[k])) fd.append(k, String(body[k]).trim());
  }
  for (const k of CLEARABLE_TEXT) {
    if (body[k] !== undefined && body[k] !== null) {
      fd.append(k, String(body[k]).trim());
    }
  }
  for (const k of IMAGE_FIELDS) {
    if (body[k] instanceof File) fd.append(k, body[k]);
  }
  return fd;
}

/** page params → params the backend reads */
export const mapDriverParams = (p = {}) =>
  clean({
    page: p.page,
    limit: p.pageSize ?? p.limit,
    search: typeof p.search === 'string' ? p.search.trim() : p.search,
    status: p.status, // available | assigned | inactive | Active | Inactive
    paymentType: p.paymentType, // fixed | percentage
    sort: p.sort,
  });

// ------------------------------------------------------------------
// API
// ------------------------------------------------------------------
export const driverApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ---------- List ----------
    getDrivers: builder.query({
      query: (params = {}) => ({
        url: '/drivers',
        params: mapDriverParams(params),
      }),
      transformResponse: (res) => toList(res, withId),
      providesTags: ['Drivers'],
    }),

    // ---------- Stats ----------
    getDriverStats: builder.query({
      query: () => '/drivers/stats',
      transformResponse: (res) => unwrap(res),
      providesTags: ['Drivers', 'Dashboard'],
    }),

    // ---------- Available (for booking form) ----------
    // Backend returns a plain array when no pagination is requested.
    // Supports optional pickupDate + returnDate for collision check.
    getAvailableDrivers: builder.query({
      query: (params = {}) => ({
        url: '/drivers/available',
        params: clean({
          pickupDate: params.pickupDate,
          returnDate: params.returnDate,
          page: params.page,
          limit: params.pageSize ?? params.limit,
        }),
      }),
      transformResponse: (res) => toList(res, withId),
      providesTags: ['Drivers', 'Bookings'],
    }),

    // ---------- Single driver ----------
    getDriver: builder.query({
      query: (id) => `/drivers/${id}`,
      transformResponse: (res) => {
        const b = unwrap(res);
        return withId(b?.driver ?? b);
      },
      providesTags: (result, error, id) => ['Drivers', { type: 'Drivers', id }],
    }),

    // ---------- Bookings of a driver ----------
    // Response shape: { driver, summary, items, pagination }
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
          pageSize: body.pagination?.limit ?? (body.items || []).length,
          total: body.pagination?.total ?? (body.items || []).length,
          totalPages: body.pagination?.totalPages ?? 1,
        };
      },
      providesTags: ['Drivers', 'Bookings'],
    }),

    // ---------- Payment history of a driver ----------
    // Response shape: { driver, summary, items, pagination }
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
          pageSize: body.pagination?.limit ?? (body.items || []).length,
          total: body.pagination?.total ?? (body.items || []).length,
          totalPages: body.pagination?.totalPages ?? 1,
        };
      },
      providesTags: ['Drivers', 'Payments', 'Expenses'],
    }),

    // ---------- Full overview ----------
    // Response shape: { driver, summary, bookings, payments, ... }
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
      providesTags: ['Drivers', 'Bookings', 'Payments', 'Expenses'],
    }),

    // ---------- Mutations (multipart) ----------
    addDriver: builder.mutation({
      // Do NOT set Content-Type – browser adds the boundary
      query: (body) => ({
        url: '/drivers',
        method: 'POST',
        body: toDriverFormData(body),
      }),
      invalidatesTags: DRIVER_TAGS,
    }),

    updateDriver: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/drivers/${id}`,
        method: 'PATCH',
        body: toDriverFormData(body),
      }),
      invalidatesTags: DRIVER_TAGS,
    }),

    deleteDriver: builder.mutation({
      query: (id) => ({
        url: `/drivers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: DRIVER_TAGS,
    }),
  }),
  overrideExisting: false,
});

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