/**
 * src/offline/db.js
 *
 * Dexie schema for RentACarOfflineDB.
 *
 * - Version 1 is UNCHANGED (all existing tables, indexes and records are preserved).
 * - Version 2 only ADDS `queryCache` (tenant + user scoped API snapshots).
 * - This database is never deleted or recreated by refresh, navigation, logout or sync.
 */
import Dexie from "dexie";

export const db = new Dexie("RentACarOfflineDB");

db.version(1).stores({
  cars: "id, businessId, status, numberPlate, brand, model, fuelType, transmission, dailyRent, hourlyRent, nextServiceDate, nextOilChangeDate, insuranceExpiry, registrationExpiry, tokenTaxExpiry, updatedAt, [businessId+status], [businessId+numberPlate]",
  bookings: "id, businessId, status, customerId, carId, driverId, employeeId, bookingNumber, invoiceNumber, pickupDate, returnDate, createdAt, updatedAt, [businessId+status], [businessId+customerId], [businessId+carId], [businessId+driverId], [businessId+pickupDate], [businessId+returnDate]",
  customers: "id, businessId, name, phone, email, cnic, customerCode, status, type, city, createdAt, updatedAt, [businessId+status], [businessId+phone], [businessId+cnic], [businessId+customerCode]",
  drivers: "id, businessId, name, phone, status, paymentType, licenseExpiry, createdAt, updatedAt, [businessId+status], [businessId+name]",
  payments: "id, businessId, bookingId, type, method, status, paymentNumber, idempotencyKey, paymentDate, amount, createdAt, updatedAt, [businessId+bookingId], [businessId+type], [businessId+status], [businessId+paymentDate], [businessId+idempotencyKey]",
  expenses: "id, businessId, category, carId, bookingId, driverId, expenseDate, amount, paymentMethod, createdAt, updatedAt, [businessId+category], [businessId+carId], [businessId+bookingId], [businessId+driverId], [businessId+expenseDate]",
  inspections: "id, businessId, bookingId, carId, type, inspectionDate, createdAt, updatedAt, [businessId+bookingId], [businessId+carId], [businessId+type], [businessId+bookingId+type]",
  settings: "id, businessId, updatedAt",
  outbox: "++id, entity, action, status, businessId, localId, serverId, createdAt, updatedAt, attempts, [entity+status], [businessId+status], [status+createdAt]",
  meta: "key",
});

// v2: additive only. Tables not listed here are inherited unchanged from v1.
db.version(2).stores({
  queryCache: "key, businessId, userId, path, updatedAt, [businessId+userId]",
});

// ======================================================
// ID HELPERS
// ======================================================

export function createLocalId(prefix = "local") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isLocalId(id) {
  return typeof id === "string" && id.startsWith("local_");
}

export const OUTBOX_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  FAILED: "failed",
  SYNCED: "synced",
};

export const OUTBOX_ENTITIES = [
  "car", "booking", "customer", "driver", "payment", "expense", "inspection", "settings",
];

export const OUTBOX_ACTIONS = { CREATE: "create", UPDATE: "update", DELETE: "delete" };

// ======================================================
// PERSISTENT TEMP-ID -> SERVER-ID MAP (per business, stored in meta)
// ======================================================

export const idMapKey = (businessId) => `sync:idmap:${businessId}`;

export async function getIdMap(businessId) {
  const row = await db.meta.get(idMapKey(businessId));
  return row?.value || {};
}

export async function getMappedId(businessId, localId) {
  return (await getIdMap(businessId))[localId] || null;
}

/** Ask the browser not to evict IndexedDB under storage pressure. Safe to call repeatedly. */
export async function requestPersistentStorage() {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // ignore
  }
  return false;
}

export const tables = {
  cars: db.cars,
  bookings: db.bookings,
  customers: db.customers,
  drivers: db.drivers,
  payments: db.payments,
  expenses: db.expenses,
  inspections: db.inspections,
  settings: db.settings,
  outbox: db.outbox,
  meta: db.meta,
  queryCache: db.queryCache,
};

export default db;