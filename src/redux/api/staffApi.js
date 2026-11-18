
/**
 * src/redux/api/staffApi.js
 *
 * Staff Management API
 *
 * ONLINE:
 * - Fetch staff data from backend.
 * - Cache successful GET responses in IndexedDB.
 * - Execute staff mutations on backend only.
 *
 * OFFLINE:
 * - Read previously cached staff information.
 * - Never create or modify employees offline.
 * - Never queue permission or password changes.
 *
 * SECURITY:
 * - Offline cache restricted to tenant admins.
 * - Cache isolated by business and authenticated user.
 * - Sensitive authentication fields are not cached.
 *
 * COMPATIBILITY:
 * - All 8 existing endpoints preserved.
 * - All existing hooks preserved.
 * - Existing argument formats preserved.
 */

import { baseApi, clean } from "./baseApi";
import { unwrap } from "./bookingApi";

import {
  isBrowserOnline,
  isNetworkFailure,
} from "@/offline/offlineAdapter";

import {
  getMeta,
  setMeta,
} from "@/offline/cache";

// ======================================================
// CONFIGURATION
// ======================================================

const STAFF_TAGS = [
  "Staff",
  "Auth",
  "Dashboard",
];

const CACHE_PREFIX = "staff-cache:v2";

// Backend multer field name.
const AVATAR_FIELD = "avatar";

// ======================================================
// GENERAL HELPERS
// ======================================================

const getId = (value) => {
  if (value && typeof value === "object") {
    return value._id ?? value.id ?? null;
  }

  return value ?? null;
};

const withId = (record) => {
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record)
  ) {
    return record;
  }

  return {
    ...record,
    id: record.id ?? record._id,
  };
};

const toList = (response) => {
  const body = unwrap(response) || {};
  const items = (body.items || []).map(withId);
  const pagination = body.pagination || {};

  return {
    items,
    pagination,
    page: pagination.page ?? body.page ?? 1,
    pageSize:
      pagination.limit ??
      body.pageSize ??
      items.length,
    total:
      pagination.total ??
      body.total ??
      items.length,
    totalPages:
      pagination.totalPages ??
      body.totalPages ??
      1,
  };
};

const offlineError = (message) => ({
  status: "CUSTOM_ERROR",
  error: message,
  data: {
    success: false,
    message,
    _offline: true,
    _unavailable: true,
  },
});

// ======================================================
// STAFF QUERY PARAMETERS
// ======================================================

/**
 * Backend accepts:
 *
 * page, limit, search, status, dataScope
 *
 * No unsupported sort or role parameters.
 */
export const mapStaffParams = (params = {}) =>
  clean({
    page: params.page,
    limit: params.pageSize ?? params.limit,
    search:
      typeof params.search === "string"
        ? params.search.trim()
        : params.search,
    status: params.status,
    dataScope: params.dataScope,
  });

// ======================================================
// STAFF REQUEST BODY
// ======================================================

/**
 * CREATE:
 * name, email, phone, password,
 * permissions, dataScope
 *
 * UPDATE:
 * name, phone
 *
 * Profile image:
 * multipart field = avatar
 */
function staffBody(body = {}, creating = false) {
  const json = {
    name: String(body.name ?? "").trim(),
    phone: String(body.phone ?? "").trim(),
  };

  if (creating) {
    json.email = String(body.email ?? "").trim();
    json.password = body.password;
    json.permissions = body.permissions ?? [];
    json.dataScope = body.dataScope || "own";
  }

  const file =
    typeof File !== "undefined" &&
    body.photo instanceof File
      ? body.photo
      : null;

  if (!file) {
    return json;
  }

  const formData = new FormData();

  Object.entries(json).forEach(([key, value]) => {
    formData.append(
      key,
      key === "permissions"
        ? JSON.stringify(value)
        : String(value)
    );
  });

  formData.append(AVATAR_FIELD, file);

  return formData;
}

// ======================================================
// AUTHENTICATED CACHE CONTEXT
// ======================================================

function getStaffContext(api) {
  const auth = api.getState()?.auth || {};
  const user = auth.user || {};

  const businessId = getId(
    auth.businessId ??
    user.businessId ??
    user.business
  );

  const userId = getId(
    user._id ?? user.id
  );

  const role = auth.role ?? user.role;

  if (
    !auth.token ||
    !businessId ||
    !userId ||
    role !== "admin"
  ) {
    return null;
  }

  return {
    businessId: String(businessId),
    userId: String(userId),
  };
}

// ======================================================
// STABLE CACHE KEY
// ======================================================

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return value.map(stableSerialize);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [
          key,
          stableSerialize(item),
        ])
    );
  }

  return value;
}

function buildCacheKey(
  context,
  endpoint,
  params = {}
) {
  return JSON.stringify({
    namespace: CACHE_PREFIX,
    businessId: context.businessId,
    userId: context.userId,
    endpoint,
    params: stableSerialize(clean(params)),
  });
}

// ======================================================
// SENSITIVE FIELD REMOVAL
// ======================================================

/**
 * Remove known authentication secrets recursively
 * before storing responses in IndexedDB.
 *
 * Note: Staff names, emails and phone numbers remain
 * personal data and require device-level protection.
 */
const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "passwordResetToken",
  "resetPasswordToken",
  "resetPasswordExpires",
  "refreshToken",
  "accessToken",
  "token",
  "secret",
  "otp",
  "otpCode",
  "twoFactorSecret",
]);

function sanitizeStaffData(value) {
  if (Array.isArray(value)) {
    return value.map(sanitizeStaffData);
  }

  if (
    !value ||
    typeof value !== "object"
  ) {
    return value;
  }

  const result = {};

  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_FIELDS.has(key)) {
      continue;
    }

    result[key] = sanitizeStaffData(item);
  }

  return result;
}

// ======================================================
// INDEXEDDB CACHE
// ======================================================

async function saveStaffCache(key, data) {
  try {
    await setMeta(key, {
      data: sanitizeStaffData(data),
      cachedAt: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Staff API] Cache write failed:",
        error
      );
    }

    return false;
  }
}

async function readStaffCache(key) {
  try {
    const cached = await getMeta(key);

    if (
      !cached ||
      !Object.prototype.hasOwnProperty.call(
        cached,
        "data"
      )
    ) {
      return null;
    }

    return cached;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Staff API] Cache read failed:",
        error
      );
    }

    return null;
  }
}

// ======================================================
// SHARED ONLINE / OFFLINE READ
// ======================================================

async function executeStaffRead({
  url,
  params = {},
  api,
  baseQuery,
  transform = (data) => data,
}) {
  const context = getStaffContext(api);
  const queryParams = clean(params);

  // ==================================================
  // 1. ONLINE REQUEST
  // ==================================================

  if (isBrowserOnline()) {
    const result = await baseQuery({
      url,
      method: "GET",
      params: queryParams,
    });

    if (!result.error) {
      const data = transform(result.data);

      if (context) {
        const cacheKey = buildCacheKey(
          context,
          url,
          queryParams
        );

        await saveStaffCache(cacheKey, data);
      }

      return { data };
    }

    // Never bypass real backend errors.
    if (!isNetworkFailure(result.error)) {
      return {
        error: result.error,
      };
    }
  }

  // ==================================================
  // 2. OFFLINE CACHE
  // ==================================================

  if (!context) {
    return {
      error: offlineError(
        "Offline staff information is unavailable for this account."
      ),
    };
  }

  const cacheKey = buildCacheKey(
    context,
    url,
    queryParams
  );

  const cached = await readStaffCache(cacheKey);

  if (cached) {
    const data = cached.data;

    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data)
    ) {
      return {
        data: {
          ...data,
          _offline: true,
          _fromCache: true,
          _cachedAt: cached.cachedAt,
        },
      };
    }

    return { data };
  }

  // ==================================================
  // 3. NO CACHE
  // ==================================================

  return {
    error: offlineError(
      "Staff information has not been cached yet. Connect to the internet to load it."
    ),
  };
}

// ======================================================
// ONLINE-ONLY STAFF MUTATIONS
// ======================================================

/**
 * Staff and permission changes must be confirmed
 * by the backend.
 *
 * These requests are never queued in IndexedDB.
 */
async function executeStaffMutation({
  url,
  method,
  body,
  baseQuery,
}) {
  if (!isBrowserOnline()) {
    return {
      error: offlineError(
        "Internet connection is required to manage staff."
      ),
    };
  }

  return baseQuery({
    url,
    method,
    body,
  });
}

// ======================================================
// STAFF API
// ======================================================

export const staffApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ==================================================
    // GET STAFF LIST
    // ==================================================

    getStaff: builder.query({
      async queryFn(
        params = {},
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffRead({
          url: "/employees",
          params: mapStaffParams(params),
          api,
          baseQuery,
          transform: toList,
        });
      },

      providesTags: ["Staff"],
    }),

    // ==================================================
    // GET PERMISSION OPTIONS
    // ==================================================

    getStaffOptions: builder.query({
      async queryFn(
        _arg,
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffRead({
          url: "/employees/permissions",
          api,
          baseQuery,
          transform: (response) => unwrap(response),
        });
      },

      providesTags: ["Staff"],
    }),

    // ==================================================
    // GET SINGLE STAFF MEMBER
    // ==================================================

    getStaffMember: builder.query({
      async queryFn(
        id,
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffRead({
          url: `/employees/${id}`,
          api,
          baseQuery,
          transform: (response) =>
            withId(unwrap(response)),
        });
      },

      providesTags: (result, error, id) => [
        "Staff",
        {
          type: "Staff",
          id,
        },
      ],
    }),

    // ==================================================
    // ADD STAFF - ONLINE ONLY
    // ==================================================

    addStaff: builder.mutation({
      async queryFn(
        body,
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffMutation({
          url: "/employees",
          method: "POST",
          body: staffBody(body, true),
          baseQuery,
        });
      },

      invalidatesTags: STAFF_TAGS,
    }),

    // ==================================================
    // UPDATE STAFF - ONLINE ONLY
    // ==================================================

    updateStaff: builder.mutation({
      async queryFn(
        { id, ...body },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffMutation({
          url: `/employees/${id}`,
          method: "PATCH",
          body: staffBody(body, false),
          baseQuery,
        });
      },

      invalidatesTags: STAFF_TAGS,
    }),

    // ==================================================
    // UPDATE PERMISSIONS - ONLINE ONLY
    // ==================================================

    updateStaffPermissions: builder.mutation({
      async queryFn(
        { id, permissions, dataScope },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffMutation({
          url: `/employees/${id}/permissions`,
          method: "PATCH",
          body: {
            permissions,
            dataScope,
          },
          baseQuery,
        });
      },

      invalidatesTags: STAFF_TAGS,
    }),

    // ==================================================
    // UPDATE STATUS - ONLINE ONLY
    // ==================================================

    updateStaffStatus: builder.mutation({
      async queryFn(
        { id, status },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffMutation({
          url: `/employees/${id}/status`,
          method: "PATCH",
          body: { status },
          baseQuery,
        });
      },

      invalidatesTags: STAFF_TAGS,
    }),

    // ==================================================
    // RESET PASSWORD - ONLINE ONLY
    // ==================================================

    resetStaffPassword: builder.mutation({
      async queryFn(
        { id, newPassword },
        api,
        _extraOptions,
        baseQuery
      ) {
        return executeStaffMutation({
          url: `/employees/${id}/reset-password`,
          method: "POST",
          body: { newPassword },
          baseQuery,
        });
      },

      invalidatesTags: [
        "Staff",
        "Auth",
      ],
    }),

  }),

  overrideExisting: false,
});

// ======================================================
// EXPORT EXISTING HOOKS
// ======================================================

export const {
  useGetStaffQuery,
  useLazyGetStaffQuery,

  useGetStaffOptionsQuery,
  useLazyGetStaffOptionsQuery,

  useGetStaffMemberQuery,
  useLazyGetStaffMemberQuery,

  useAddStaffMutation,
  useUpdateStaffMutation,

  useUpdateStaffPermissionsMutation,
  useUpdateStaffStatusMutation,

  useResetStaffPasswordMutation,
} = staffApi;
