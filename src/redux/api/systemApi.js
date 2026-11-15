import { baseApi, clean } from "./baseApi";

export const systemApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // Dashboard stats
    // GET /dashboard
    // --------------------------------------------------
    getDashboard: builder.query({
      query: (params = {}) => ({
        url: "/dashboard",
        method: "GET",
        params: clean(params),
      }),
      providesTags: ["Dashboard"],
    }),

    // --------------------------------------------------
    // Reminders list
    // GET /dashboard/reminders
    // --------------------------------------------------
    getReminders: builder.query({
      query: (params = {}) => ({
        url: "/dashboard/reminders",
        method: "GET",
        params: clean(params),
      }),
      providesTags: ["Reminders"],
    }),

    // --------------------------------------------------
    // Mark reminder as done
    // PATCH /dashboard/reminders/:id/complete
    // --------------------------------------------------
    completeReminder: builder.mutation({
      query: (id) => ({
        url: `/dashboard/reminders/${id}/complete`,
        method: "PATCH",
      }),
      invalidatesTags: ["Reminders", "Notifications"],
    }),

    // --------------------------------------------------
    // Reopen a completed reminder
    // PATCH /dashboard/reminders/:id/reopen
    // --------------------------------------------------
    reopenReminder: builder.mutation({
      query: (id) => ({
        url: `/dashboard/reminders/${id}/reopen`,
        method: "PATCH",
      }),
      invalidatesTags: ["Reminders", "Notifications"],
    }),

    // --------------------------------------------------
    // Notifications
    // GET /dashboard/notifications
    // --------------------------------------------------
    getNotifications: builder.query({
      query: (params = {}) => ({
        url: "/dashboard/notifications",
        method: "GET",
        params: clean(params),
      }),
      providesTags: ["Notifications"],
    }),

    // --------------------------------------------------
    // Global search
    // GET /dashboard/search?q=...
    // --------------------------------------------------
    searchAll: builder.query({
      query: (params = {}) => ({
        url: "/dashboard/search",
        method: "GET",
        params: clean(
          typeof params === "string" ? { q: params } : params ?? {}
        ),
      }),
      // search results are ephemeral – no long-lived tags needed
    }),
  }),

  // Allow this file to be the single source of truth
  overrideExisting: true,
});

export const {
  useGetDashboardQuery,
  useLazyGetDashboardQuery,

  useGetRemindersQuery,
  useLazyGetRemindersQuery,
  useCompleteReminderMutation,
  useReopenReminderMutation,

  useGetNotificationsQuery,
  useLazyGetNotificationsQuery,

  useSearchAllQuery,
  useLazySearchAllQuery,
} = systemApi;