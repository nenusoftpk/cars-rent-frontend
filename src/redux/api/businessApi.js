
import { baseApi } from "./baseApi";

export const businessApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyBusiness: builder.query({
      query: () => ({
        url: "/business/me",
        method: "GET",
      }),
      providesTags: ["Business", "Settings"],
    }),

    updateMyBusiness: builder.mutation({
      query: (body) => ({
        url: "/business/me",
        method: "PATCH",
        body,
      }),
      invalidatesTags: [
        "Business",
        "Settings",
        "Auth",
        "Dashboard",
        "Reports",
      ],
    }),
  }),

  overrideExisting: false,
});

export const {
  useGetMyBusinessQuery,
  useLazyGetMyBusinessQuery,
  useUpdateMyBusinessMutation,
} = businessApi;
