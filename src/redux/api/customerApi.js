import { baseApi, clean } from "./baseApi";

import {
  executeOffline,
  isBrowserOnline,
  isNetworkFailure,
  readOfflineRecords,
} from "@/offline/offlineAdapter";

// ======================================================
// CACHE TAGS
// ======================================================

const CUSTOMER_TAGS = [
  "Customers",
  "Bookings",
  "Payments",
  "Reports",
  "Dashboard",
  "Documents",
  "Ledger",
];

// ======================================================
// CUSTOMER FIELDS
// ======================================================

// Guarantor request fields (must match the backend controller exactly):
//   guarantor{1|2}Enabled / Name / Mobile  -> text
//   guarantor{1|2}Photo / CnicFront / CnicBack -> image files
const GUARANTOR_NUMBERS = [1, 2];

const GUARANTOR_TEXT_FIELDS = GUARANTOR_NUMBERS.flatMap((n) => [
  `guarantor${n}Enabled`,
  `guarantor${n}Name`,
  `guarantor${n}Mobile`,
]);

const GUARANTOR_IMAGE_FIELDS = GUARANTOR_NUMBERS.flatMap((n) => [
  `guarantor${n}Photo`,
  `guarantor${n}CnicFront`,
  `guarantor${n}CnicBack`,
]);

const CUSTOMER_TEXT_FIELDS = [
  "name",
  "mobile",
  "phone",
  "alternatePhone",
  "email",
  "gender",
  "type",
  "address",
  "city",
  "cnic",
  "licenseNo",
  "licenseNumber",
  "licenseExpiry",
  "openingBalance",
  "notes",
  "status",
  "customerCode",
  ...GUARANTOR_TEXT_FIELDS,
];

const CUSTOMER_IMAGE_FIELDS = [
  "photo",
  "cnicFront",
  "cnicBack",
  "licenseImage",
  ...GUARANTOR_IMAGE_FIELDS,
];

// ======================================================
// GENERAL HELPERS
// ======================================================

const idOf = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object") {
    return value.id ?? value._id ?? null;
  }

  return value;
};

const sameId = (a, b) => {
  const left = idOf(a);
  const right = idOf(b);

  return (
    left !== null &&
    right !== null &&
    String(left) === String(right)
  );
};

const isRealFile = (value) =>
  typeof File !== "undefined" && value instanceof File;

const isBase64Image = (value) =>
  typeof value === "string" &&
  /^data:image\/(?:jpeg|png|webp);base64,/i.test(value);

const hasNewFiles = (body = {}) =>
  CUSTOMER_IMAGE_FIELDS.some(
    (key) => isRealFile(body[key]) || isBase64Image(body[key])
  );

function base64ToFile(dataUrl, fieldName) {
  const [header, base64] = dataUrl.split(",");

  const mimeType =
    header.match(/^data:(image\/(?:jpeg|png|webp));base64$/i)?.[1];

  if (!mimeType || !base64) {
    throw new Error(`Invalid image for ${fieldName}`);
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const extension =
    mimeType.toLowerCase() === "image/jpeg"
      ? "jpg"
      : mimeType.split("/")[1].toLowerCase();

  return new File(
    [bytes],
    `${fieldName}-${Date.now()}.${extension}`,
    { type: mimeType }
  );
}

const unwrap = (response) => {
  if (
    response &&
    typeof response === "object" &&
    response.success !== undefined &&
    response.data !== undefined
  ) {
    return response.data;
  }

  return response;
};

const toArray = (value) =>
  Array.isArray(value) ? value : [];

const numberOrNull = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
};

// ======================================================
// CUSTOMER NORMALIZATION
// ======================================================

function mapGuarantor(guarantor) {
  const g = guarantor && typeof guarantor === "object" ? guarantor : {};

  return {
    enabled: Boolean(g.enabled),
    name: g.name ?? "",
    mobile: g.mobile ?? "",
    photo: g.photo ?? "",
    cnicFront: g.cnicFront ?? "",
    cnicBack: g.cnicBack ?? "",
    locked: Boolean(g.locked),
  };
}

function mapCustomer(customer) {
  if (!customer || typeof customer !== "object") {
    return customer;
  }

  return {
    ...customer,
    id: idOf(customer),
    guarantor1: mapGuarantor(customer.guarantor1),
    guarantor2: mapGuarantor(customer.guarantor2),
    mobile:
      customer.mobile ??
      customer.phone ??
      "",
    licenseNo:
      customer.licenseNo ??
      customer.licenseNumber ??
      "",
  };
}

function mapBooking(booking = {}) {
  const car =
    booking.car && typeof booking.car === "object"
      ? booking.car
      : booking.carId &&
        typeof booking.carId === "object"
        ? booking.carId
        : {};

  return {
    ...booking,
    id: idOf(booking),
    number:
      booking.number ??
      booking.bookingNumber ??
      booking.invoiceNumber ??
      "",
    carName:
      booking.carName ??
      car.name ??
      "",
    carImage:
      booking.carImage ??
      car.image ??
      car.images?.[0] ??
      null,
    pickupAt:
      booking.pickupAt ??
      booking.pickupDate ??
      booking.startDate ??
      null,
    returnAt:
      booking.returnAt ??
      booking.returnDate ??
      booking.endDate ??
      null,
    total:
      booking.total ??
      booking.totalAmount ??
      0,
    displayStatus:
      booking.displayStatus ??
      booking.status ??
      "",
  };
}

function mapPayment(payment = {}) {
  return {
    ...payment,
    id: idOf(payment),
    date:
      payment.date ??
      payment.paymentDate ??
      payment.paidAt ??
      payment.createdAt ??
      null,
    receiptNo:
      payment.receiptNo ??
      payment.paymentNumber ??
      payment.reference ??
      "",
    type:
      payment.type ??
      payment.paymentType ??
      "Payment",
    method:
      payment.method ??
      payment.paymentMethod ??
      "",
    amount: payment.amount ?? 0,
  };
}

/**
 * CustomerDrawer requires:
 *
 * c.bookings.length
 * c.payments.length
 * c.totalBookings
 * c.totalSpent
 * c.pending
 *
 * Never return undefined arrays.
 *
 * Financial totals are not invented from incomplete
 * offline payment data.
 */
function normalizeCustomerDetails(raw) {
  const body = unwrap(raw) || {};
  const customer = mapCustomer(body);

  const bookings = toArray(body.bookings).map(
    mapBooking
  );

  const payments = toArray(body.payments).map(
    mapPayment
  );

  return {
    ...customer,

    bookings,
    payments,

    totalBookings:
      numberOrNull(body.totalBookings) ??
      bookings.length,

    totalSpent:
      numberOrNull(body.totalSpent),

    pending:
      numberOrNull(body.pending),

    _offline: Boolean(body._offline),

    _fromCache: Boolean(body._fromCache),

    _relationshipsPartial: Boolean(
      body._relationshipsPartial
    ),
  };
}

// ======================================================
// CUSTOMER LIST NORMALIZATION
// ======================================================

function normalizeList(raw, mapper = mapCustomer) {
  const body = unwrap(raw);

  if (Array.isArray(body)) {
    const items = body.map(mapper);

    return {
      items,
      pagination: {
        page: 1,
        limit: items.length,
        total: items.length,
        totalPages: 1,
      },
      page: 1,
      pageSize: items.length,
      total: items.length,
      totalPages: 1,
    };
  }

  const data = body || {};

  const items = toArray(
    data.items ??
    data.records ??
    data.results
  ).map(mapper);

  const pagination = data.pagination || {};

  const page =
    data.page ??
    pagination.page ??
    1;

  const pageSize =
    data.pageSize ??
    pagination.limit ??
    items.length;

  const total =
    data.total ??
    pagination.total ??
    items.length;

  const totalPages =
    data.totalPages ??
    pagination.totalPages ??
    Math.max(
      1,
      Math.ceil(total / (pageSize || 1))
    );

  return {
    ...data,
    items,
    pagination: {
      ...pagination,
      page,
      limit: pageSize,
      total,
      totalPages,
    },
    page,
    pageSize,
    total,
    totalPages,
  };
}

// ======================================================
// REQUEST BODY HELPERS
// ======================================================

function toCustomerJSON(body = {}) {
  const result = {};

  for (const key of CUSTOMER_TEXT_FIELDS) {
    const value = body[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      result[key] = value;
    }
  }

  return result;
}

function toCustomerFormData(body = {}) {
  const fd = new FormData();

  for (const key of CUSTOMER_TEXT_FIELDS) {
    const value = body[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      fd.append(key, String(value));
    }
  }

  for (const key of CUSTOMER_IMAGE_FIELDS) {
    const value = body[key];

    if (isRealFile(value)) {
      fd.append(key, value);
    } else if (isBase64Image(value)) {
      fd.append(key, base64ToFile(value, key));
    }
  }

  return fd;
}

function buildCustomerBody(body = {}) {
  return hasNewFiles(body)
    ? toCustomerFormData(body)
    : toCustomerJSON(body);
}

// ======================================================
// OFFLINE AUTH CONTEXT
// ======================================================

/**
 * Match the existing baseApi.js offline policy.
 *
 * Currently only tenant admins can access IndexedDB
 * through the API layer.
 *
 * Do not enable employees by using an unrestricted
 * access filter.
 */
function getOfflineContext(api) {
  const auth = api.getState()?.auth || {};
  const user = auth.user || {};

  const businessId = idOf(
    auth.businessId ??
    user.businessId ??
    user.business
  );

  if (
    !auth.token ||
    !businessId ||
    user.role !== "admin"
  ) {
    return null;
  }

  const tenantId = String(businessId);

  return {
    businessId: tenantId,

    accessFilter: (record) =>
      sameId(record?.businessId, tenantId),
  };
}

// ======================================================
// OFFLINE CUSTOMER DETAILS
// ======================================================

async function getOfflineCustomerDetails(
  customerId,
  api
) {
  const context = getOfflineContext(api);

  if (!context) {
    return {
      error: {
        status: 403,
        data: {
          message:
            "Offline customer access is not available for this session.",
        },
      },
    };
  }

  const result = await executeOffline({
    action: "customerDetails",
    entity: "customer",

    businessId: context.businessId,
    id: customerId,

    customerAccessFilter:
      context.accessFilter,

    bookingAccessFilter:
      context.accessFilter,

    paymentAccessFilter:
      context.accessFilter,

    carAccessFilter:
      context.accessFilter,
  });

  if (result.error) {
    return result;
  }

  return {
    data: normalizeCustomerDetails(result.data),
  };
}

// ======================================================
// OFFLINE CUSTOMER RELATIONSHIPS
// ======================================================

function paginateRelatedRecords(
  records,
  params = {}
) {
  const page = Math.max(
    1,
    Number.parseInt(params.page, 10) || 1
  );

  const limit = Math.max(
    1,
    Math.min(
      3000,
      Number.parseInt(
        params.limit ?? params.pageSize,
        10
      ) || 10
    )
  );

  const total = records.length;

  const totalPages = Math.max(
    1,
    Math.ceil(total / limit)
  );

  const start = (page - 1) * limit;

  const items = records.slice(
    start,
    start + limit
  );

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    page,
    pageSize: limit,
    total,
    totalPages,
    _offline: true,
    _relationshipsPartial: true,
  };
}

async function getOfflineRelationship(
  customerId,
  type,
  params,
  api
) {
  const result = await getOfflineCustomerDetails(
    customerId,
    api
  );

  if (result.error) {
    return result;
  }

  const records =
    type === "bookings"
      ? result.data.bookings
      : result.data.payments;

  return {
    data: paginateRelatedRecords(
      records,
      params
    ),
  };
}

// ======================================================
// ONLINE / OFFLINE FALLBACK
// ======================================================

/**
 * baseApi already supports offline customer CRUD.
 *
 * For customer details we need the richer adapter
 * action because generic GET returns only the
 * customer record.
 */
async function customerDetailsQuery(
  customerId,
  api,
  baseQuery
) {
  if (!customerId) {
    return {
      error: {
        status: 400,
        data: {
          message: "Customer ID is required.",
        },
      },
    };
  }

  if (!isBrowserOnline()) {
    return getOfflineCustomerDetails(
      customerId,
      api
    );
  }

  const result = await baseQuery({
    url: `/customers/${encodeURIComponent(
      customerId
    )}`,
    method: "GET",
  });

  if (result.error) {
    if (isNetworkFailure(result.error)) {
      return getOfflineCustomerDetails(
        customerId,
        api
      );
    }

    return { error: result.error };
  }

  // baseApi may already have returned a basic
  // IndexedDB customer after a network failure.
  if (result.data?._offline) {
    return getOfflineCustomerDetails(
      customerId,
      api
    );
  }

  return {
    data: normalizeCustomerDetails(
      result.data
    ),
  };
}

async function customerRelationshipQuery(
  { id, params, type },
  api,
  baseQuery
) {
  if (!id) {
    return {
      error: {
        status: 400,
        data: {
          message: "Customer ID is required.",
        },
      },
    };
  }

  if (!isBrowserOnline()) {
    return getOfflineRelationship(
      id,
      type,
      params,
      api
    );
  }

  const result = await baseQuery({
    url: `/customers/${encodeURIComponent(
      id
    )}/${type}`,
    method: "GET",
    params: clean(params),
  });

  if (!result.error) {
    return {
      data: normalizeList(
        result.data,
        type === "bookings"
          ? mapBooking
          : mapPayment
      ),
    };
  }

  if (isNetworkFailure(result.error)) {
    return getOfflineRelationship(
      id,
      type,
      params,
      api
    );
  }

  return { error: result.error };
}


function buildOfflineCustomerSummary(customers = []) {
  const now = new Date();

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  return {
    total: customers.length,

    active: customers.filter(
      (customer) =>
        String(customer.status || "").toLowerCase() ===
        "active"
    ).length,

    // This card counts customers with unpaid balances,
    // rather than adding their outstanding amounts.
    pending: customers.filter(
      (customer) =>
        Number(customer.pending ?? 0) > 0
    ).length,

    newThisMonth: customers.filter((customer) => {
      if (!customer.createdAt) return false;

      const date = new Date(customer.createdAt);

      return (
        !Number.isNaN(date.getTime()) &&
        date.getFullYear() === currentYear &&
        date.getMonth() === currentMonth
      );
    }).length,
  };
}

async function addOfflineCustomerSummary(data, api) {
  if (!data?._offline) return data;

  const context = getOfflineContext(api);

  if (!context) return data;

  try {
    // Read ALL locally cached customers, not just
    // the current paginated table page.
    const customers = await readOfflineRecords({
      entity: "customer",
      businessId: context.businessId,
      accessFilter: context.accessFilter,
    });

    return {
      ...data,
      summary: buildOfflineCustomerSummary(customers),
    };
  } catch (error) {
    console.warn(
      "Unable to calculate offline customer summary:",
      error
    );

    return data;
  }
}

// ======================================================
// CUSTOMER API
// ======================================================

export const customerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ==================================================
    // GET CUSTOMERS
    // ==================================================


    getCustomers: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        const result = await baseQuery({
          url: "/customers",
          method: "GET",
          params: clean(params),
        });

        if (result.error) {
          return { error: result.error };
        }

        const normalized = normalizeList(
          result.data,
          mapCustomer
        );

        const data = await addOfflineCustomerSummary(
          normalized,
          api
        );

        return { data };
      },

      providesTags: (result) => [
        "Customers",
        ...toArray(result?.items).map(
          (customer) => ({
            type: "Customers",
            id: customer.id,
          })
        ),
      ],
    }),


    // ==================================================
    // GET CUSTOMER DETAILS
    // ==================================================

    getCustomer: builder.query({
      async queryFn(
        id,
        api,
        _extraOptions,
        baseQuery
      ) {
        return customerDetailsQuery(
          id,
          api,
          baseQuery
        );
      },

      providesTags: (_result, _error, id) => [
        "Customers",
        "Bookings",
        "Payments",
        {
          type: "Customers",
          id,
        },
      ],
    }),

    // ==================================================
    // ADD CUSTOMER
    // ==================================================

    addCustomer: builder.mutation({
      query: (body = {}) => ({
        url: "/customers",
        method: "POST",
        body: buildCustomerBody(body),
      }),

      transformResponse: (response) =>
        mapCustomer(response),

      invalidatesTags: CUSTOMER_TAGS,
    }),

    // ==================================================
    // UPDATE CUSTOMER
    // ==================================================

    updateCustomer: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/customers/${encodeURIComponent(
          id
        )}`,
        method: "PATCH",
        body: buildCustomerBody(body),
      }),

      transformResponse: (response) =>
        mapCustomer(response),

      invalidatesTags: CUSTOMER_TAGS,
    }),

    // ==================================================
    // DELETE CUSTOMER
    // ==================================================

    deleteCustomer: builder.mutation({
      query: (id) => ({
        url: `/customers/${encodeURIComponent(
          id
        )}`,
        method: "DELETE",
      }),

      invalidatesTags: CUSTOMER_TAGS,
    }),

    // ==================================================
    // CUSTOMER BOOKINGS
    // ==================================================

    getCustomerBookings: builder.query({
      async queryFn(
        { id, ...params },
        api,
        _extraOptions,
        baseQuery
      ) {
        return customerRelationshipQuery(
          {
            id,
            params,
            type: "bookings",
          },
          api,
          baseQuery
        );
      },

      providesTags: (
        _result,
        _error,
        { id }
      ) => [
          "Customers",
          "Bookings",
          {
            type: "Customers",
            id,
          },
        ],
    }),

    // ==================================================
    // CUSTOMER PAYMENTS
    // ==================================================

    getCustomerPayments: builder.query({
      async queryFn(
        { id, ...params },
        api,
        _extraOptions,
        baseQuery
      ) {
        return customerRelationshipQuery(
          {
            id,
            params,
            type: "payments",
          },
          api,
          baseQuery
        );
      },

      providesTags: (
        _result,
        _error,
        { id }
      ) => [
          "Customers",
          "Payments",
          "Ledger",
          {
            type: "Customers",
            id,
          },
        ],
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// EXISTING HOOK EXPORTS
// ======================================================

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