
import {
  configureStore,
} from "@reduxjs/toolkit";

import {
  setupListeners,
} from "@reduxjs/toolkit/query";

import { baseApi } from "./api/baseApi";

// ======================================================
// REDUX SLICES
// ======================================================

import auth from "./slices/authSlice";
import ui from "./slices/uiSlice";
import sync from "./slices/syncSlice";

// ======================================================
// REGISTER ALL RTK QUERY API MODULES
// ======================================================

// Authentication
import "./api/authApi";

// Business management
import "./api/businessApi";

// Cars and inspections
import "./api/carApi";
import "./api/carInspectionApi";

// Bookings
import "./api/bookingApi";

// Customers
import "./api/customerApi";

// Drivers
import "./api/driverApi";

// Payments and expenses
import "./api/paymentApi";
import "./api/expenseApi";

// Customer ledger
import "./api/ledgerApi";

// Dashboard
import "./api/dashboardApi";

// Reports and profits
import "./api/reportApi";
import "./api/profitApi";

// Employees
import "./api/staffApi";

// Settings
import "./api/settingApi";

// Subscriptions
import "./api/subscriptionApi";

// Super Admin platform
import "./api/platformApi";

// Reminders, notifications and global search
import "./api/systemApi";

// ======================================================
// STORE FACTORY
// ======================================================

// Next.js App Router should create a separate Redux
// store instance for each server request.
//
// Your ReduxProvider uses useRef(makeStore())
// to preserve one store instance on the client.

export const makeStore = () => {
  const store = configureStore({
    // ==================================================
    // REDUCERS
    // ==================================================

    reducer: {
      // Shared RTK Query cache
      [baseApi.reducerPath]: baseApi.reducer,

      // Authentication state
      auth,

      // UI state
      ui,

      // Offline / synchronization state
      sync,
    },

    // ==================================================
    // MIDDLEWARE
    // ==================================================

    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        thunk: true,
        serializableCheck: true,
        immutableCheck: true,
      }).concat(baseApi.middleware),

    // ==================================================
    // REDUX DEVTOOLS
    // ==================================================

    devTools:
      process.env.NODE_ENV !== "production",
  });

  // ==================================================
  // RTK QUERY LISTENERS
  // ==================================================

  // Required for:
  //
  // refetchOnFocus: true
  // refetchOnReconnect: true
  //
  // These options are configured in baseApi.js.
  //
  // Only register browser listeners on the client.

  if (typeof window !== "undefined") {
    setupListeners(store.dispatch);
  }

  return store;
};
