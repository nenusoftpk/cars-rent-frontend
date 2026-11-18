/**
 * src/offline/index.js
 *
 * Public entry point for the offline module.
 * Import everything you need from here:
 *
 *   import { db, runSync, createOffline, carsCache } from "@/offline";
 */

// ======================================================
// DATABASE
// ======================================================
export { default as db } from "./db";
export {
  createLocalId,
  isLocalId,
  OUTBOX_STATUS,
  OUTBOX_ACTIONS,
  OUTBOX_ENTITIES,
  tables,
} from "./db";

// ======================================================
// OUTBOX (offline mutations)
// ======================================================
export {
  addToOutbox,
  getPendingItems,
  getPendingCount,
  getOutboxItem,
  markSyncing,
  markSynced,
  markFailed,
  retryItem,
  clearSyncedItems,
  clearAllOutbox,
  createOffline,
  updateOffline,
  deleteOffline,
} from "./outbox";

// ======================================================
// CACHE (read / write helpers)
// ======================================================
export {
  getById,
  getAll,
  put,
  bulkPut,
  remove,
  clearTable,
  getByBusiness,
  getByBusinessAndStatus,
  // Specialized caches
  carsCache,
  bookingsCache,
  customersCache,
  driversCache,
  paymentsCache,
  expensesCache,
  inspectionsCache,
  settingsCache,
  // Meta
  getMeta,
  setMeta,
  getLastSyncAt,
  setLastSyncAt,
} from "./cache";

// ======================================================
// SYNC ENGINE
// ======================================================
export { runSync, syncIfNeeded } from "./syncEngine";