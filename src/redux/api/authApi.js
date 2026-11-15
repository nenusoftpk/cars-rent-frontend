
import { baseApi } from "./baseApi";

import {
  setCredentials,
  setUser,
  logout,
} from "../slices/authSlice";

// ======================================================
// CONSTANTS
// ======================================================

const AUTH_URL = "/auth";
const STORAGE_KEY = "rac_auth";

// ======================================================
// SESSION STORAGE
// ======================================================

const saveSession = ({ token, user }) => {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token,
        user,
      })
    );
  } catch {
    // Browser storage unavailable.
  }
};

const removeSession = () => {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Browser storage unavailable.
  }
};

// ======================================================
// SESSION MANAGEMENT
// ======================================================

const clearAuthSession = (dispatch) => {
  dispatch(logout());
  removeSession();
  dispatch(baseApi.util.resetApiState());
};

const saveAuthSession = (dispatch, data) => {
  // baseApi already unwraps { success, message, data }.
  const token = data?.token;
  const user = data?.user;

  if (!token || !user) {
    return false;
  }

  // Remove cached data from any previous tenant.
  dispatch(baseApi.util.resetApiState());

  dispatch(setCredentials({ token, user }));

  saveSession({ token, user });

  return true;
};

const updateStoredUser = (getState, user) => {
  if (!user) return;

  const token = getState()?.auth?.token;

  if (token) {
    saveSession({ token, user });
  }
};

// ======================================================
// AUTH API
// ======================================================

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({

    // ==================================================
    // 1. SIGNUP
    // POST /auth/signup
    // ==================================================

    signup: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/signup`,
        method: "POST",
        body,
      }),

      async onQueryStarted(
        _arg,
        { dispatch, queryFulfilled }
      ) {
        try {
          const { data } = await queryFulfilled;

          saveAuthSession(dispatch, data);
        } catch {
          // Error returned by mutation.
        }
      },
    }),

    // ==================================================
    // 2. LOGIN
    // POST /auth/login
    // ==================================================

    login: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/login`,
        method: "POST",
        body,
      }),

      async onQueryStarted(
        _arg,
        { dispatch, queryFulfilled }
      ) {
        try {
          const { data } = await queryFulfilled;

          saveAuthSession(dispatch, data);
        } catch {
          // Error returned by mutation.
        }
      },
    }),

    // ==================================================
    // 3. FORGOT PASSWORD
    // POST /auth/forgot-password
    // ==================================================

    forgotPassword: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/forgot-password`,
        method: "POST",
        body,
      }),
    }),

    // ==================================================
    // 4. RESET PASSWORD
    // POST /auth/reset-password
    // ==================================================

    resetPassword: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/reset-password`,
        method: "POST",
        body,
      }),
    }),

    // ==================================================
    // 5. VERIFY EMAIL
    // POST /auth/verify-email
    // ==================================================

    verifyEmail: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/verify-email`,
        method: "POST",
        body,
      }),

      invalidatesTags: ["Auth"],
    }),

    // ==================================================
    // 6. GET MY PROFILE
    // GET /auth/me
    // ==================================================

    getMe: builder.query({
      query: () => ({
        url: `${AUTH_URL}/me`,
        method: "GET",
      }),

      providesTags: ["Auth"],

      async onQueryStarted(
        _arg,
        { dispatch, getState, queryFulfilled }
      ) {
        try {
          const { data } = await queryFulfilled;

          const user = data;

          if (user) {
            dispatch(setUser(user));
            updateStoredUser(getState, user);
          }
        } catch {
          // Error handled by baseApi.
        }
      },
    }),

    // ==================================================
    // 7. UPDATE PROFILE
    // PATCH /auth/profile
    // ==================================================

    updateProfile: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/profile`,
        method: "PATCH",
        body,
      }),

      invalidatesTags: ["Auth", "Staff"],

      async onQueryStarted(
        _arg,
        { dispatch, getState, queryFulfilled }
      ) {
        try {
          const { data } = await queryFulfilled;

          if (data) {
            const currentUser = getState()?.auth?.user;

            const user = {
              ...(currentUser || {}),
              ...data,
            };

            dispatch(setUser(user));
            updateStoredUser(getState, user);
          }
        } catch {
          // Mutation exposes the error.
        }
      },
    }),

    // ==================================================
    // 8. CHANGE PASSWORD
    // PATCH /auth/change-password
    //
    // Backend increments tokenVersion.
    // Current JWT becomes invalid.
    // ==================================================

    changePassword: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/change-password`,
        method: "PATCH",
        body,
      }),

      async onQueryStarted(
        _arg,
        { dispatch, queryFulfilled }
      ) {
        try {
          await queryFulfilled;
          clearAuthSession(dispatch);
        } catch {
          // Keep session on failure.
        }
      },
    }),

    // ==================================================
    // 9. RESEND EMAIL VERIFICATION
    // POST /auth/resend-verification
    // ==================================================

    resendVerification: builder.mutation({
      query: () => ({
        url: `${AUTH_URL}/resend-verification`,
        method: "POST",
        body: {},
      }),
    }),

    // ==================================================
    // 10. UPDATE EMAIL
    // PATCH /auth/update-email
    //
    // Backend increments tokenVersion.
    // User must log in again.
    // ==================================================

    updateEmail: builder.mutation({
      query: (body) => ({
        url: `${AUTH_URL}/update-email`,
        method: "PATCH",
        body,
      }),

      async onQueryStarted(
        _arg,
        { dispatch, queryFulfilled }
      ) {
        try {
          await queryFulfilled;
          clearAuthSession(dispatch);
        } catch {
          // Keep session on failure.
        }
      },
    }),

    // ==================================================
    // 11. LOGOUT
    // POST /auth/logout
    //
    // Backend revokes all user sessions.
    // ==================================================

    logoutUser: builder.mutation({
      query: () => ({
        url: `${AUTH_URL}/logout`,
        method: "POST",
        body: {},
      }),

      async onQueryStarted(
        _arg,
        { dispatch, queryFulfilled }
      ) {
        try {
          await queryFulfilled;
          clearAuthSession(dispatch);
        } catch {
          // Keep session if server logout fails.
        }
      },
    }),

    // ==================================================
    // 12. LOGOUT ALL DEVICES
    // POST /auth/logout-all
    // ==================================================

    logoutAllDevices: builder.mutation({
      query: () => ({
        url: `${AUTH_URL}/logout-all`,
        method: "POST",
        body: {},
      }),

      async onQueryStarted(
        _arg,
        { dispatch, queryFulfilled }
      ) {
        try {
          await queryFulfilled;
          clearAuthSession(dispatch);
        } catch {
          // Keep session if request fails.
        }
      },
    }),

  }),

  overrideExisting: false,
});

// ======================================================
// GENERATED HOOKS
// ======================================================

export const {
  useSignupMutation,
  useLoginMutation,

  useForgotPasswordMutation,
  useResetPasswordMutation,

  useVerifyEmailMutation,
  useResendVerificationMutation,

  useGetMeQuery,
  useLazyGetMeQuery,

  useUpdateProfileMutation,
  useChangePasswordMutation,
  useUpdateEmailMutation,

  useLogoutUserMutation,
  useLogoutAllDevicesMutation,
} = authApi;
