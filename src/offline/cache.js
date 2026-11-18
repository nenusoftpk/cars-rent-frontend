/**
 * src/offline/cache.js
 *
 * Simple helpers to read / write data from IndexedDB.
 * Used by both the UI (when offline) and the syncEngine.
 */

import { db } from "./db";

// ======================================================
// GENERIC HELPERS
// ======================================================

/**
 * Get one record by id
 */
export async function getById(tableName, id) {
  if (!id) return null;
  return db.table(tableName).get(id);
}

/**
 * Get many records (with optional filter function)
 */
export async function getAll(tableName, filterFn = null) {
  const items = await db.table(tableName).toArray();
  return filterFn ? items.filter(filterFn) : items;
}

/**
 * Put (insert or update) one record
 */
export async function put(tableName, record) {
  if (!record?.id) {
    throw new Error("Record must have an id");
  }
  return db.table(tableName).put(record);
}

/**
 * Put many records at once (very useful after pull from server)
 */
export async function bulkPut(tableName, records = []) {
  if (!Array.isArray(records) || records.length === 0) return;
  return db.table(tableName).bulkPut(records);
}

/**
 * Delete one record
 */
export async function remove(tableName, id) {
  return db.table(tableName).delete(id);
}

/**
 * Clear a whole table
 */
export async function clearTable(tableName) {
  return db.table(tableName).clear();
}

// ======================================================
// BUSINESS-SCOPED HELPERS (most common use case)
// ======================================================

/**
 * Get all records of a table that belong to a business
 */
export async function getByBusiness(tableName, businessId) {
  return db.table(tableName).where("businessId").equals(businessId).toArray();
}

/**
 * Get records by business + status
 */
export async function getByBusinessAndStatus(tableName, businessId, status) {
  return db
    .table(tableName)
    .where("[businessId+status]")
    .equals([businessId, status])
    .toArray();
}

// ======================================================
// SPECIALIZED HELPERS
// ======================================================

/** Cars */
export const carsCache = {
  getAll: (businessId) => getByBusiness("cars", businessId),
  getById: (id) => getById("cars", id),
  put: (car) => put("cars", car),
  bulkPut: (cars) => bulkPut("cars", cars),
  remove: (id) => remove("cars", id),
  clear: () => clearTable("cars"),
};

/** Bookings */
export const bookingsCache = {
  getAll: (businessId) => getByBusiness("bookings", businessId),
  getById: (id) => getById("bookings", id),
  getByStatus: (businessId, status) =>
    getByBusinessAndStatus("bookings", businessId, status),
  put: (booking) => put("bookings", booking),
  bulkPut: (bookings) => bulkPut("bookings", bookings),
  remove: (id) => remove("bookings", id),
  clear: () => clearTable("bookings"),
};

/** Customers */
export const customersCache = {
  getAll: (businessId) => getByBusiness("customers", businessId),
  getById: (id) => getById("customers", id),
  put: (customer) => put("customers", customer),
  bulkPut: (customers) => bulkPut("customers", customers),
  remove: (id) => remove("customers", id),
  clear: () => clearTable("customers"),
};

/** Drivers */
export const driversCache = {
  getAll: (businessId) => getByBusiness("drivers", businessId),
  getById: (id) => getById("drivers", id),
  put: (driver) => put("drivers", driver),
  bulkPut: (drivers) => bulkPut("drivers", drivers),
  remove: (id) => remove("drivers", id),
  clear: () => clearTable("drivers"),
};

/** Payments */
export const paymentsCache = {
  getAll: (businessId) => getByBusiness("payments", businessId),
  getByBooking: async (businessId, bookingId) => {
    const all = await getByBusiness("payments", businessId);
    return all.filter((p) => p.bookingId === bookingId);
  },
  put: (payment) => put("payments", payment),
  bulkPut: (payments) => bulkPut("payments", payments),
  remove: (id) => remove("payments", id),
  clear: () => clearTable("payments"),
};

/** Expenses */
export const expensesCache = {
  getAll: (businessId) => getByBusiness("expenses", businessId),
  put: (expense) => put("expenses", expense),
  bulkPut: (expenses) => bulkPut("expenses", expenses),
  remove: (id) => remove("expenses", id),
  clear: () => clearTable("expenses"),
};

/** Inspections */
export const inspectionsCache = {
  getAll: (businessId) => getByBusiness("inspections", businessId),
  getByBooking: async (businessId, bookingId) => {
    const all = await getByBusiness("inspections", businessId);
    return all.filter((i) => i.bookingId === bookingId);
  },
  put: (inspection) => put("inspections", inspection),
  bulkPut: (inspections) => bulkPut("inspections", inspections),
  remove: (id) => remove("inspections", id),
  clear: () => clearTable("inspections"),
};

/** Settings */
export const settingsCache = {
  get: async (businessId) => {
    const items = await getByBusiness("settings", businessId);
    return items[0] || null;
  },
  put: (settings) => put("settings", settings),
  clear: () => clearTable("settings"),
};

// ======================================================
// META HELPERS
// ======================================================

export async function getMeta(key) {
  const row = await db.meta.get(key);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  return db.meta.put({ key, value });
}

export async function getLastSyncAt() {
  return getMeta("lastSyncAt");
}

export async function setLastSyncAt(date = new Date()) {
  return setMeta("lastSyncAt", date.toISOString());
}