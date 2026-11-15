
import { baseApi } from "./baseApi";

export const subscriptionApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMySubscription: builder.query({
      query: () => ({
        url: "/subscriptions/me",
        method: "GET",
      }),
      providesTags: [
        "Subscriptions",
        "Auth",
        "Business",
        "Settings",
      ],
    }),
  }),

  overrideExisting: false,
});

export const {
  useGetMySubscriptionQuery,
  useLazyGetMySubscriptionQuery,
} = subscriptionApi;
