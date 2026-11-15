import { baseApi, clean } from "./baseApi";

/**
 * Report types that map 1-to-1 to backend routes:
 *   GET /reports/{name}
 */
const REPORT_TYPES = [
  "income-expense",
  "bookings",
  "payments",
  "expenses",
  "customers",
  "cars-status",
  "drivers",
];

const REPORT_TAGS = [
  "Reports",
  "Bookings",
  "Payments",
  "Expenses",
  "Customers",
  "Cars",
  "Drivers",
  "Profits",
  "Dashboard",
];

export const reportApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // Dashboard (used by src/app/dashboard/page.jsx)
    // --------------------------------------------------
    getDashboard: builder.query({
      query: (params = {}) => ({
        url: "/dashboard",          // ← change to "/reports/dashboard" if your backend uses that
        method: "GET",
        params: clean(params),
      }),
      providesTags: ["Dashboard", ...REPORT_TAGS],
    }),

    // --------------------------------------------------
    // Unified report used by the Reports page
    // --------------------------------------------------
    getReport: builder.query({
      async queryFn({ name, ...params }, _api, _extraOptions, baseQuery) {
        const reportName = String(name || "")
          .trim()
          .toLowerCase()
          .replace(/_/g, "-");

        if (!REPORT_TYPES.includes(reportName)) {
          return {
            error: {
              status: "CUSTOM_ERROR",
              error: "Invalid report type",
              data: {
                message: `Invalid report type: ${name}. Allowed: ${REPORT_TYPES.join(", ")}`,
              },
            },
          };
        }

        return baseQuery({
          url: `/reports/${reportName}`,
          method: "GET",
          params: clean(params),
        });
      },
      providesTags: REPORT_TAGS,
    }),

    // --------------------------------------------------
    // Individual report endpoints (kept for compatibility)
    // --------------------------------------------------
    getIncomeExpenseReport: builder.query({
      query: (params = {}) => ({
        url: "/reports/income-expense",
        method: "GET",
        params: clean(params),
      }),
      providesTags: REPORT_TAGS,
    }),

    getBookingReport: builder.query({
      query: (params = {}) => ({
        url: "/reports/bookings",
        method: "GET",
        params: clean(params),
      }),
      providesTags: REPORT_TAGS,
    }),

    getPaymentReport: builder.query({
      query: (params = {}) => ({
        url: "/reports/payments",
        method: "GET",
        params: clean(params),
      }),
      providesTags: REPORT_TAGS,
    }),

    getExpenseReport: builder.query({
      query: (params = {}) => ({
        url: "/reports/expenses",
        method: "GET",
        params: clean(params),
      }),
      providesTags: REPORT_TAGS,
    }),

    getCustomerReport: builder.query({
      query: (params = {}) => ({
        url: "/reports/customers",
        method: "GET",
        params: clean(params),
      }),
      providesTags: REPORT_TAGS,
    }),

    getCarsStatusReport: builder.query({
      query: (params = {}) => ({
        url: "/reports/cars-status",
        method: "GET",
        params: clean(params),
      }),
      providesTags: REPORT_TAGS,
    }),

    getDriverReport: builder.query({
      query: (params = {}) => ({
        url: "/reports/drivers",
        method: "GET",
        params: clean(params),
      }),
      providesTags: REPORT_TAGS,
    }),
  }),

  overrideExisting: true,
});

export const {
  // Dashboard
  useGetDashboardQuery,
  useLazyGetDashboardQuery,

  // Unified
  useGetReportQuery,
  useLazyGetReportQuery,

  // Individual
  useGetIncomeExpenseReportQuery,
  useLazyGetIncomeExpenseReportQuery,
  useGetBookingReportQuery,
  useLazyGetBookingReportQuery,
  useGetPaymentReportQuery,
  useLazyGetPaymentReportQuery,
  useGetExpenseReportQuery,
  useLazyGetExpenseReportQuery,
  useGetCustomerReportQuery,
  useLazyGetCustomerReportQuery,
  useGetCarsStatusReportQuery,
  useLazyGetCarsStatusReportQuery,
  useGetDriverReportQuery,
  useLazyGetDriverReportQuery,
} = reportApi;