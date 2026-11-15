import { baseApi, clean } from "./baseApi";

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // Main dashboard stats
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
    // Centralised reminders
    // GET /dashboard/reminders
    // Supports: view, search, type, source, category,
    //           priority, from, to, page, pageSize, days
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
    // Notifications (high / medium priority reminders)
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
    globalSearch: builder.query({
      query: (params = {}) => ({
        url: "/dashboard/search",
        method: "GET",
        params: clean(params),
      }),
      // No long-lived tags – search is ephemeral
    }),
  }),

  overrideExisting: false,
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

  useGlobalSearchQuery,
  useLazyGlobalSearchQuery,
} = dashboardApi;