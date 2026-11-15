import { baseApi, clean } from "./baseApi";

const CUSTOMER_TAGS = [
  "Customers",
  "Bookings",
  "Payments",
  "Reports",
  "Dashboard",
  "Documents",
  "Ledger",
];

/**
 * Convert a normal JS object + optional File objects into FormData.
 * Only appends real File instances for the image fields.
 * Skips empty strings / null / undefined so the backend does not overwrite
 * existing images with empty values on PATCH.
 */
function toCustomerFormData(body = {}) {
  const fd = new FormData();

  const textFields = [
    "name",
    "mobile",        // controller maps → phone
    "phone",
    "alternatePhone",
    "email",
    "gender",
    "type",
    "address",
    "city",
    "cnic",
    "licenseNo",     // controller maps → licenseNumber
    "licenseNumber",
    "licenseExpiry",
    "openingBalance",
    "notes",
    "status",
    "customerCode",
  ];

  for (const key of textFields) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== "") {
      fd.append(key, String(body[key]));
    }
  }

  // Image fields – only real File objects are sent
  const imageFields = ["photo", "cnicFront", "cnicBack", "licenseImage"];
  for (const key of imageFields) {
    const value = body[key];
    if (value instanceof File) {
      fd.append(key, value);
    }
    // Existing Cloudinary URLs are ignored on purpose – backend keeps them
  }

  return fd;
}

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getCustomers: builder.query({
      query: (params = {}) => ({
        url: "/customers",
        params: clean(params),
      }),
      providesTags: ["Customers"],
    }),

    getCustomer: builder.query({
      query: (id) => `/customers/${id}`,
      providesTags: (result, error, id) => [
        "Customers",
        { type: "Customers", id },
      ],
    }),

    addCustomer: builder.mutation({
      query: (body) => {
        // Always use multipart – works for both with/without images
        const formData = toCustomerFormData(body);
        return {
          url: "/customers",
          method: "POST",
          body: formData,
          // IMPORTANT: do NOT set Content-Type – browser sets the boundary
        };
      },
      invalidatesTags: CUSTOMER_TAGS,
    }),

    updateCustomer: builder.mutation({
      query: ({ id, ...body }) => {
        const formData = toCustomerFormData(body);
        return {
          url: `/customers/${id}`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: CUSTOMER_TAGS,
    }),

    deleteCustomer: builder.mutation({
      query: (id) => ({
        url: `/customers/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: CUSTOMER_TAGS,
    }),

    getCustomerBookings: builder.query({
      query: ({ id, ...params }) => ({
        url: `/customers/${id}/bookings`,
        params: clean(params),
      }),
      providesTags: ["Customers", "Bookings"],
    }),

    getCustomerPayments: builder.query({
      query: ({ id, ...params }) => ({
        url: `/customers/${id}/payments`,
        params: clean(params),
      }),
      providesTags: ["Customers", "Payments", "Ledger"],
    }),
  }),

  overrideExisting: false,
});

export const {
  useGetCustomersQuery,
  useLazyGetCustomersQuery,
  useGetCustomerQuery,
  useLazyGetCustomerQuery,
  useAddCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useGetCustomerBookingsQuery,
  useLazyGetCustomerBookingsQuery,
  useGetCustomerPaymentsQuery,
  useLazyGetCustomerPaymentsQuery,
} = customerApi;