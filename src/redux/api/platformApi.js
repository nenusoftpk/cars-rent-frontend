
import { baseApi, clean } from "./baseApi";

const PLATFORM_TAGS = [
  "Platform",
  "Business",
  "Subscriptions",
  "Settings",
  "Auth",
];

export const platformApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listPlatformBusinesses: builder.query({
      query: (params = {}) => ({
        url: "/platform/businesses",
        params: clean(params),
      }),
      providesTags: ["Platform", "Business"],
    }),

    setBusinessStatus: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/platform/businesses/${id}/status`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: PLATFORM_TAGS,
    }),

    listPlatformSubscriptions: builder.query({
      query: (params = {}) => ({
        url: "/platform/subscriptions",
        params: clean(params),
      }),
      providesTags: ["Platform", "Subscriptions"],
    }),

    getPlatformSubscription: builder.query({
      query: (businessId) =>
        `/platform/subscriptions/${businessId}`,
      providesTags: (result, error, businessId) => [
        "Platform",
        "Subscriptions",
        { type: "Subscriptions", id: businessId },
      ],
    }),

    setPlatformSubscription: builder.mutation({
      query: ({ businessId, ...body }) => ({
        url: `/platform/subscriptions/${businessId}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: PLATFORM_TAGS,
    }),

    setBusinessSubscription: builder.mutation({
      query: ({ businessId, ...body }) => ({
        url: `/platform/businesses/${businessId}/subscription`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: PLATFORM_TAGS,
    }),
  }),

  overrideExisting: false,
});

export const {
  useListPlatformBusinessesQuery,
  useLazyListPlatformBusinessesQuery,
  useSetBusinessStatusMutation,
  useListPlatformSubscriptionsQuery,
  useLazyListPlatformSubscriptionsQuery,
  useGetPlatformSubscriptionQuery,
  useLazyGetPlatformSubscriptionQuery,
  useSetPlatformSubscriptionMutation,
  useSetBusinessSubscriptionMutation,
} = platformApi;
