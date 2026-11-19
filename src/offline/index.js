/**
 * src/offline/index.js — public entry point of the offline module.
 *   import { db, runSync, createOffline, carsCache } from "@/offline";
 */
export { default as db } from "./db";
export {
  createLocalId, isLocalId, OUTBOX_STATUS, OUTBOX_ACTIONS, OUTBOX_ENTITIES, tables,
  getIdMap, getMappedId, requestPersistentStorage,
} from "./db";

export {
  addToOutbox, getPendingItems, getPendingCount, getHeldItems, hasPending, getOutboxItem,
  markSyncing, markSynced, markFailed, retryItem, retryFailedItems, discardItem,
  clearSyncedItems, clearAllOutbox, recoverInterruptedItems,
  createOffline, updateOffline, deleteOffline, MAX_ATTEMPTS,
} from "./outbox";

export {
  getById, getAll, put, bulkPut, remove, clearTable, getByBusiness, getByBusinessAndStatus,
  carsCache, bookingsCache, customersCache, driversCache, paymentsCache, expensesCache,
  inspectionsCache, settingsCache, getMeta, setMeta, getLastSyncAt, setLastSyncAt,
} from "./cache";

export { runSync, syncIfNeeded, probeBackend } from "./syncEngine";
export { clearSnapshots } from "./queryCache";
export {
  resolveContext, markVerified, isWithinOfflineWindow, OFFLINE_SESSION_DAYS,
} from "./session";