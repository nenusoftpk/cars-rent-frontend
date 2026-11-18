
import { createSlice } from "@reduxjs/toolkit";

// ======================================================
// SYNC STATUS CONSTANTS
// ======================================================

export const SYNC_STATUS = Object.freeze({
  SYNCED: "synced",
  SYNCING: "syncing",
  PENDING: "pending",
  OFFLINE: "offline",
  FAILED: "failed",
  CONFLICT: "conflict",
});

// ======================================================
// INITIAL STATE
// ======================================================

const initialState = {
  // Browser connection status
  online: true,

  // Current synchronization status
  status: SYNC_STATUS.SYNCED,

  // Number of unsynchronized outbox operations
  pending: 0,

  // Last successful synchronization
  lastSyncAt: null,

  // Sync activity
  isSyncing: false,

  // Last synchronization error
  error: null,

  // Last sync result
  lastResult: null,

  // Sync progress
  progress: {
    total: 0,
    completed: 0,
    failed: 0,
    current: null,
  },

  // Number of unresolved conflicts
  conflicts: 0,
};

// ======================================================
// HELPERS
// ======================================================

const safeCount = (value) => {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.floor(number));
};

const getIdleStatus = (state) => {
  if (!state.online) {
    return SYNC_STATUS.OFFLINE;
  }

  if (state.conflicts > 0) {
    return SYNC_STATUS.CONFLICT;
  }

  if (state.pending > 0) {
    return SYNC_STATUS.PENDING;
  }

  return SYNC_STATUS.SYNCED;
};

const normalizeError = (error) => {
  if (!error) {
    return null;
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error.message === "string") {
    return error.message;
  }

  if (typeof error.data?.message === "string") {
    return error.data.message;
  }

  return "Synchronization failed.";
};

// ======================================================
// REDUX SLICE
// ======================================================

const syncSlice = createSlice({
  name: "sync",

  initialState,

  reducers: {
    // ==================================================
    // ONLINE / OFFLINE STATUS
    // ==================================================

    setOnline: (state, { payload }) => {
      state.online = Boolean(payload);

      if (!state.online) {
        state.isSyncing = false;
        state.status = SYNC_STATUS.OFFLINE;
        return;
      }

      if (state.isSyncing) {
        state.status = SYNC_STATUS.SYNCING;
        return;
      }

      if (
        state.status === SYNC_STATUS.FAILED &&
        state.error
      ) {
        return;
      }

      state.status = getIdleStatus(state);
    },

    // ==================================================
    // MARK A NEW OFFLINE OPERATION AS PENDING
    // ==================================================

    markPending: (state) => {
      state.pending += 1;

      if (state.isSyncing) {
        return;
      }

      if (
        state.status === SYNC_STATUS.CONFLICT ||
        state.status === SYNC_STATUS.FAILED
      ) {
        return;
      }

      state.status = state.online
        ? SYNC_STATUS.PENDING
        : SYNC_STATUS.OFFLINE;
    },

    // ==================================================
    // SET EXACT PENDING COUNT
    // ==================================================

    // Use the actual IndexedDB outbox count instead
    // of relying only on markPending().
    //
    // Example:
    // dispatch(setPending(await getPendingCount(businessId)));

    setPending: (state, { payload }) => {
      state.pending = safeCount(payload);

      if (state.isSyncing) {
        return;
      }

      if (
        state.status === SYNC_STATUS.FAILED &&
        state.error
      ) {
        return;
      }

      state.status = getIdleStatus(state);
    },

    // ==================================================
    // SET SYNC STATUS
    // ==================================================

    // Preserves compatibility with syncEngine.js:
    //
    // dispatch(setSyncStatus("syncing"));
    // dispatch(setSyncStatus("synced"));
    // dispatch(setSyncStatus("pending"));
    // dispatch(setSyncStatus("failed"));

    setSyncStatus: (state, { payload }) => {
      const status = payload;

      if (!Object.values(SYNC_STATUS).includes(status)) {
        return;
      }

      state.status = status;

      state.isSyncing =
        status === SYNC_STATUS.SYNCING;

      if (status === SYNC_STATUS.SYNCED) {
        state.error = null;

        // IMPORTANT:
        // Do not force pending = 0 here.
        // The actual count must come from IndexedDB.
        state.lastSyncAt = new Date().toISOString();
      }

      if (status === SYNC_STATUS.OFFLINE) {
        state.online = false;
        state.isSyncing = false;
      }

      if (
        status === SYNC_STATUS.FAILED ||
        status === SYNC_STATUS.CONFLICT
      ) {
        state.isSyncing = false;
      }
    },

    // ==================================================
    // START SYNC
    // ==================================================

    startSync: (state, { payload }) => {
      state.isSyncing = true;
      state.status = SYNC_STATUS.SYNCING;
      state.error = null;

      state.progress = {
        total: safeCount(payload?.total),
        completed: 0,
        failed: 0,
        current: null,
      };
    },

    // ==================================================
    // UPDATE SYNC PROGRESS
    // ==================================================

    setSyncProgress: (state, { payload }) => {
      if (!payload || typeof payload !== "object") {
        return;
      }

      if (payload.total !== undefined) {
        state.progress.total = safeCount(
          payload.total
        );
      }

      if (payload.completed !== undefined) {
        state.progress.completed = safeCount(
          payload.completed
        );
      }

      if (payload.failed !== undefined) {
        state.progress.failed = safeCount(
          payload.failed
        );
      }

      if (payload.current !== undefined) {
        state.progress.current =
          payload.current == null
            ? null
            : String(payload.current);
      }
    },

    // ==================================================
    // SYNC COMPLETED
    // ==================================================

    syncCompleted: (state, { payload }) => {
      const result = payload || {};

      state.isSyncing = false;
      state.error = null;

      if (result.pending !== undefined) {
        state.pending = safeCount(result.pending);
      }

      if (result.lastSyncAt) {
        state.lastSyncAt = result.lastSyncAt;
      } else if (
        result.success === true &&
        state.pending === 0
      ) {
        state.lastSyncAt = new Date().toISOString();
      }

      state.lastResult = {
        success: result.success === true,
        pushed: safeCount(result.pushed),
        failed: safeCount(result.failed),
        pending: state.pending,
        lastSyncAt: state.lastSyncAt,
      };

      state.progress.current = null;

      if (result.success === false) {
        state.status = state.online
          ? SYNC_STATUS.FAILED
          : SYNC_STATUS.OFFLINE;

        if (result.failed > 0) {
          state.error =
            `${result.failed} operation(s) failed to synchronize.`;
        }

        return;
      }

      state.status = getIdleStatus(state);
    },

    // ==================================================
    // SYNC FAILED
    // ==================================================

    syncFailed: (state, { payload }) => {
      state.isSyncing = false;

      state.error = normalizeError(payload);

      state.status = state.online
        ? SYNC_STATUS.FAILED
        : SYNC_STATUS.OFFLINE;

      state.lastResult = {
        success: false,
        error: state.error,
        pending: state.pending,
      };
    },

    // ==================================================
    // CLEAR SYNC ERROR
    // ==================================================

    clearSyncError: (state) => {
      state.error = null;

      if (state.status === SYNC_STATUS.FAILED) {
        state.status = getIdleStatus(state);
      }
    },

    // ==================================================
    // SET CONFLICT COUNT
    // ==================================================

    setConflicts: (state, { payload }) => {
      state.conflicts = safeCount(payload);

      if (!state.isSyncing) {
        state.status = getIdleStatus(state);
      }
    },

    // ==================================================
    // UPDATE LAST SYNC TIME
    // ==================================================

    setLastSyncAt: (state, { payload }) => {
      state.lastSyncAt = payload || null;
    },

    // ==================================================
    // RESET SYNC STATE
    // ==================================================

    // Call when changing accounts/businesses or
    // clearing the authenticated application session.
    //
    // This resets Redux sync state only.
    // It does NOT delete IndexedDB or the outbox.

    resetSync: () => ({
      ...initialState,
      online:
        typeof navigator !== "undefined"
          ? navigator.onLine
          : true,
    }),
  },
});

// ======================================================
// ACTION EXPORTS
// ======================================================

export const {
  setOnline,
  markPending,
  setPending,
  setSyncStatus,
  startSync,
  setSyncProgress,
  syncCompleted,
  syncFailed,
  clearSyncError,
  setConflicts,
  setLastSyncAt,
  resetSync,
} = syncSlice.actions;

// ======================================================
// SELECTORS
// ======================================================

export const selectSync = (state) =>
  state.sync || initialState;

export const selectOnline = (state) =>
  selectSync(state).online;

export const selectSyncStatus = (state) =>
  selectSync(state).status;

export const selectIsSyncing = (state) =>
  selectSync(state).isSyncing;

export const selectPendingCount = (state) =>
  selectSync(state).pending;

export const selectLastSyncAt = (state) =>
  selectSync(state).lastSyncAt;

export const selectSyncError = (state) =>
  selectSync(state).error;

export const selectSyncProgress = (state) =>
  selectSync(state).progress;

export const selectSyncConflicts = (state) =>
  selectSync(state).conflicts;

export const selectHasPendingChanges = (state) =>
  selectSync(state).pending > 0;

// ======================================================
// DEFAULT EXPORT
// ======================================================

export default syncSlice.reducer;
