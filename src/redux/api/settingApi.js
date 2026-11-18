
/**
 * src/redux/api/settingApi.js
 *
 * Online:
 * - Fetch settings from backend
 * - Cache successful response in IndexedDB
 * - Update/reset settings on backend
 *
 * Offline:
 * - Read last cached settings
 * - Block update/reset operations
 */

import { baseApi } from "./baseApi";

import {
  isBrowserOnline,
  isNetworkFailure,
} from "@/offline/offlineAdapter";

import {
  getMeta,
  setMeta,
} from "@/offline/cache";

const SETTINGS_TAGS = [
  "Settings",
  "Business",
  "Dashboard",
  "Reports",
  "Auth",
];

const CACHE_PREFIX = "settings-cache:v1";

const getId = (value) =>
  value && typeof value === "object"
    ? value._id ?? value.id
    : value;

function getContext(api) {
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

  if (
    !auth.token ||
    !businessId ||
    !userId ||
    (auth.role ?? user.role) !== "admin"
  ) {
    return null;
  }

  return {
    businessId: String(businessId),
    userId: String(userId),
  };
}

function cacheKey(context) {
  return JSON.stringify({
    namespace: CACHE_PREFIX,
    businessId: context.businessId,
    userId: context.userId,
  });
}

function offlineError(message) {
  return {
    status: "CUSTOM_ERROR",
    error: message,
    data: {
      success: false,
      message,
      _offline: true,
    },
  };
}

export const settingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ================================================
    // GET SETTINGS
    // ================================================

    getSettings: builder.query({
      async queryFn(
        _arg,
        api,
        _extraOptions,
        baseQuery
      ) {
        const context = getContext(api);

        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: "/settings",
            method: "GET",
          });

          if (!result.error) {
            if (context) {
              try {
                await setMeta(
                  cacheKey(context),
                  {
                    data: result.data,
                    cachedAt: new Date().toISOString(),
                  }
                );
              } catch (error) {
                console.warn(
                  "[Settings] Cache failed:",
                  error
                );
              }
            }

            return { data: result.data };
          }

          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
        }

        if (!context) {
          return {
            error: offlineError(
              "Settings are unavailable offline for this account."
            ),
          };
        }

        try {
          const cached = await getMeta(
            cacheKey(context)
          );

          if (
            cached &&
            cached.data !== undefined &&
            cached.data !== null
          ) {
            return {
              data: {
                ...cached.data,
                _offline: true,
                _fromCache: true,
                _cachedAt: cached.cachedAt,
              },
            };
          }
        } catch (error) {
          console.warn(
            "[Settings] Cache read failed:",
            error
          );
        }

        return {
          error: offlineError(
            "Settings have not been cached yet. Connect to the internet first."
          ),
        };
      },

      providesTags: ["Settings"],
    }),

    // ================================================
    // UPDATE SETTINGS - ONLINE ONLY
    // ================================================

    updateSettings: builder.mutation({
      async queryFn(
        body,
        api,
        _extraOptions,
        baseQuery
      ) {
        if (!isBrowserOnline()) {
          return {
            error: offlineError(
              "Internet connection is required to update settings."
            ),
          };
        }

        return baseQuery({
          url: "/settings",
          method: "PATCH",
          body,
        });
      },

      invalidatesTags: SETTINGS_TAGS,
    }),

    // ================================================
    // RESET SETTINGS - ONLINE ONLY
    // ================================================

    resetSettings: builder.mutation({
      async queryFn(
        _arg,
        api,
        _extraOptions,
        baseQuery
      ) {
        if (!isBrowserOnline()) {
          return {
            error: offlineError(
              "Internet connection is required to reset settings."
            ),
          };
        }

        return baseQuery({
          url: "/settings/reset",
          method: "POST",
        });
      },

      invalidatesTags: SETTINGS_TAGS,
    }),

  }),

  overrideExisting: false,
});

export const {
  useGetSettingsQuery,
  useLazyGetSettingsQuery,
  useUpdateSettingsMutation,
  useResetSettingsMutation,
} = settingApi;
