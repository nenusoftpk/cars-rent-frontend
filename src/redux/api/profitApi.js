
import { baseApi, clean } from "./baseApi";

export const profitApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getBusinessProfit: builder.query({
      query: (params = {}) => ({
        url: "/profits/business",
        params: clean(params),
      }),
      providesTags: [
        "Profits",
        "Reports",
        "Payments",
        "Expenses",
        "Bookings",
      ],
    }),

    getAllCarsProfit: builder.query({
      query: (params = {}) => ({
        url: "/profits/cars",
        params: clean(params),
      }),
      providesTags: [
        "Profits",
        "Reports",
        "Cars",
        "Payments",
        "Expenses",
        "Bookings",
      ],
    }),

    getCarProfit: builder.query({
      query: ({ carId, ...params }) => ({
        url: `/profits/cars/${carId}`,
        params: clean(params),
      }),
      providesTags: (result, error, { carId }) => [
        "Profits",
        "Reports",
        "Payments",
        "Expenses",
        "Bookings",
        { type: "Cars", id: carId },
      ],
    }),
  }),

  overrideExisting: false,
});

export const {
  useGetBusinessProfitQuery,
  useLazyGetBusinessProfitQuery,
  useGetAllCarsProfitQuery,
  useLazyGetAllCarsProfitQuery,
  useGetCarProfitQuery,
  useLazyGetCarProfitQuery,
} = profitApi;
