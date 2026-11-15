
import { baseApi } from "./baseApi";

const SETTINGS_TAGS = [
  "Settings",
  "Business",
  "Dashboard",
  "Reports",
  "Auth",
];

export const settingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query({
      query: () => ({
        url: "/settings",
        method: "GET",
      }),
      providesTags: ["Settings"],
    }),

    updateSettings: builder.mutation({
      query: (body) => ({
        url: "/settings",
        method: "PATCH",
        body,
      }),
      invalidatesTags: SETTINGS_TAGS,
    }),

    resetSettings: builder.mutation({
      query: () => ({
        url: "/settings/reset",
        method: "POST",
      }),
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
