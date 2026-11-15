import { baseApi, clean } from "./baseApi";

// ======================================================
// TAGS
// ======================================================

const ADMIN_TAGS = ["Platform", "Business", "Subscriptions", "Auth"];

// ======================================================
// HELPERS
// ======================================================

const unwrap = (res) => {
  if (
    res &&
    typeof res === "object" &&
    !Array.isArray(res) &&
    res.data !== undefined &&
    (res.success !== undefined || res.message !== undefined)
  ) {
    return res.data;
  }
  return res;
};

/**
 * Normalize admin object coming from the new platformAdminController.
 * Handles both nested business/subscription and legacy flat shapes.
 */
const mapAdmin = (admin) => {
  if (!admin) return admin;

  const business =
    admin.business && typeof admin.business === "object"
      ? {
          id: admin.business.id || admin.business._id || null,
          businessName: admin.business.businessName || "",
          status: admin.business.status || "",
        }
      : null;

  const businessId =
    admin.businessId ||
    business?.id ||
    (typeof admin.businessId === "object"
      ? admin.businessId?.id || admin.businessId?._id
      : null) ||
    null;

  const subscription = admin.subscription
    ? {
        id: admin.subscription.id || admin.subscription._id || null,
        plan: admin.subscription.plan || null,
        status: admin.subscription.status || null,
        paymentStatus: admin.subscription.paymentStatus || null,
        startDate: admin.subscription.startDate || null,
        endDate: admin.subscription.endDate || null,
        trialDays: admin.subscription.trialDays ?? null,
        trialExtensionDays: admin.subscription.trialExtensionDays ?? null,
        notes: admin.subscription.notes || "",
        daysRemaining: admin.subscription.daysRemaining ?? null,
        isLifetime: admin.subscription.plan === "lifetime",
        isTrial:
          admin.subscription.plan === "trial" &&
          admin.subscription.status === "trialing",
        isActive:
          admin.subscription.status === "active" ||
          (admin.subscription.plan === "trial" &&
            admin.subscription.status === "trialing"),
      }
    : null;

  return {
    ...admin,
    id: admin.id || admin._id,
    businessId: businessId ? String(businessId) : null,
    business,
    businessName:
      admin.businessName ||
      business?.businessName ||
      admin.businessId?.businessName ||
      "",
    businessStatus:
      admin.businessStatus ||
      business?.status ||
      admin.businessId?.status ||
      "",
    subscription,
    // password hash is only present for super-admin responses
    password: admin.password || undefined,
  };
};

/**
 * Convert UI params → backend query params
 * Backend accepts: page, limit, search, status, businessId
 */
const mapAdminParams = (params = {}) => {
  const q = {};

  if (params.page) q.page = params.page;
  if (params.pageSize || params.limit) {
    q.limit = params.pageSize || params.limit;
  }
  if (params.search?.trim()) q.search = params.search.trim();
  if (params.status && params.status !== "all") q.status = params.status;
  if (params.businessId) q.businessId = params.businessId;

  return clean(q);
};

// ======================================================
// PLATFORM ADMIN API
// ======================================================

export const platformAdminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ==================================================
    // 1. LIST PLATFORM ADMINS
    // GET /platform/admins
    // ==================================================
    getPlatformAdmins: builder.query({
      query: (params = {}) => ({
        url: "/platform/admins",
        method: "GET",
        params: mapAdminParams(params),
      }),

      transformResponse: (res) => {
        const body = unwrap(res) || {};
        const items = (body.items || []).map(mapAdmin);
        const pagination = body.pagination || {};

        return {
          items,
          pagination,
          page: pagination.page ?? 1,
          pageSize: pagination.limit ?? items.length,
          total: pagination.total ?? items.length,
          totalPages: pagination.totalPages ?? 1,
        };
      },

      providesTags: ["Platform", "Subscriptions"],
    }),

    // ==================================================
    // 2. GET SINGLE PLATFORM ADMIN
    // GET /platform/admins/:id
    // ==================================================
    getPlatformAdmin: builder.query({
      query: (id) => ({
        url: `/platform/admins/${id}`,
        method: "GET",
      }),

      transformResponse: (res) => {
        const data = unwrap(res);
        return mapAdmin(data);
      },

      providesTags: (result, error, id) => [
        "Platform",
        { type: "Platform", id },
        "Subscriptions",
      ],
    }),

    // ==================================================
    // 3. UPDATE PLATFORM ADMIN
    // PATCH /platform/admins/:id
    // Body: { name?, email?, phone?, photo?, status?, password? }
    // ==================================================
    updatePlatformAdmin: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/platform/admins/${id}`,
        method: "PATCH",
        body,
      }),

      transformResponse: (res) => {
        const data = unwrap(res);
        return mapAdmin(data);
      },

      invalidatesTags: (result, error, { id }) => [
        "Platform",
        { type: "Platform", id },
        "Business",
        "Subscriptions",
        "Auth",
      ],
    }),

    // ==================================================
    // 4. UPDATE ADMIN STATUS ONLY
    // PATCH /platform/admins/:id/status
    // Body: { status: "active" | "disabled" }
    // ==================================================
    setPlatformAdminStatus: builder.mutation({
      query: ({ id, status }) => ({
        url: `/platform/admins/${id}/status`,
        method: "PATCH",
        body: { status },
      }),

      transformResponse: (res) => {
        const data = unwrap(res);
        return mapAdmin(data);
      },

      invalidatesTags: (result, error, { id }) => [
        "Platform",
        { type: "Platform", id },
        "Business",
        "Auth",
      ],
    }),

    // ==================================================
    // 5. RESET ADMIN PASSWORD
    // PATCH /platform/admins/:id/reset-password
    // Body: { newPassword }
    // ==================================================
    resetPlatformAdminPassword: builder.mutation({
      query: ({ id, newPassword }) => ({
        url: `/platform/admins/${id}/reset-password`,
        method: "PATCH",
        body: { newPassword },
      }),

      transformResponse: (res) => {
        const data = unwrap(res);
        // backend now returns the full admin object
        return data ? mapAdmin(data) : null;
      },

      invalidatesTags: (result, error, { id }) => [
        "Platform",
        { type: "Platform", id },
        "Auth",
      ],
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// GENERATED HOOKS
// ======================================================

export const {
  useGetPlatformAdminsQuery,
  useLazyGetPlatformAdminsQuery,

  useGetPlatformAdminQuery,
  useLazyGetPlatformAdminQuery,

  useUpdatePlatformAdminMutation,
  useSetPlatformAdminStatusMutation,
  useResetPlatformAdminPasswordMutation,
} = platformAdminApi;