/**
 * src/offline/db.js
 *
 * Dexie (IndexedDB) schema for offline-first Rent-a-Car system.
 *
 * Design goals:
 * - Store the same shapes the frontend already uses (after mapBooking, mapCar, etc.)
 * - Support offline create / update / delete via an outbox
 * - Fast filtering by businessId, status, dates, search fields
 * - Easy sync later (pull from MongoDB → put into these tables)
 */

import Dexie from "dexie";

// ======================================================
// DATABASE
// ======================================================

export const db = new Dexie("RentACarOfflineDB");

/**
 * Version 1 – Initial offline schema
 *
 * Primary key is always `id` (string).
 * We store both the real MongoDB _id (as id) and keep businessId for multi-tenant isolation.
 */
db.version(1).stores({
  // --------------------------------------------------
  // CARS
  // --------------------------------------------------
  cars: `
    id,
    businessId,
    status,
    numberPlate,
    brand,
    model,
    fuelType,
    transmission,
    dailyRent,
    hourlyRent,
    nextServiceDate,
    nextOilChangeDate,
    insuranceExpiry,
    registrationExpiry,
    tokenTaxExpiry,
    updatedAt,
    [businessId+status],
    [businessId+numberPlate]
  `,

  // --------------------------------------------------
  // BOOKINGS
  // --------------------------------------------------
  bookings: `
    id,
    businessId,
    status,
    customerId,
    carId,
    driverId,
    employeeId,
    bookingNumber,
    invoiceNumber,
    pickupDate,
    returnDate,
    createdAt,
    updatedAt,
    [businessId+status],
    [businessId+customerId],
    [businessId+carId],
    [businessId+driverId],
    [businessId+pickupDate],
    [businessId+returnDate]
  `,

  // --------------------------------------------------
  // CUSTOMERS
  // --------------------------------------------------
  customers: `
    id,
    businessId,
    name,
    phone,
    email,
    cnic,
    customerCode,
    status,
    type,
    city,
    createdAt,
    updatedAt,
    [businessId+status],
    [businessId+phone],
    [businessId+cnic],
    [businessId+customerCode]
  `,

  // --------------------------------------------------
  // DRIVERS
  // --------------------------------------------------
  drivers: `
    id,
    businessId,
    name,
    phone,
    status,
    paymentType,
    licenseExpiry,
    createdAt,
    updatedAt,
    [businessId+status],
    [businessId+name]
  `,

  // --------------------------------------------------
  // PAYMENTS
  // --------------------------------------------------
  payments: `
    id,
    businessId,
    bookingId,
    type,
    method,
    status,
    paymentNumber,
    idempotencyKey,
    paymentDate,
    amount,
    createdAt,
    updatedAt,
    [businessId+bookingId],
    [businessId+type],
    [businessId+status],
    [businessId+paymentDate],
    [businessId+idempotencyKey]
  `,

  // --------------------------------------------------
  // EXPENSES
  // --------------------------------------------------
  expenses: `
    id,
    businessId,
    category,
    carId,
    bookingId,
    driverId,
    expenseDate,
    amount,
    paymentMethod,
    createdAt,
    updatedAt,
    [businessId+category],
    [businessId+carId],
    [businessId+bookingId],
    [businessId+driverId],
    [businessId+expenseDate]
  `,

  // --------------------------------------------------
  // CAR INSPECTIONS (issue / return)
  // --------------------------------------------------
  inspections: `
    id,
    businessId,
    bookingId,
    carId,
    type,
    inspectionDate,
    createdAt,
    updatedAt,
    [businessId+bookingId],
    [businessId+carId],
    [businessId+type],
    [businessId+bookingId+type]
  `,

  // --------------------------------------------------
  // SETTINGS (one record per business)
  // --------------------------------------------------
  settings: `
    id,
    businessId,
    updatedAt
  `,

  // --------------------------------------------------
  // OUTBOX – heart of offline mutations
  // --------------------------------------------------
  // Every create / update / delete performed while offline
  // is stored here and later pushed to the server.
  outbox: `
    ++id,
    entity,
    action,
    status,
    businessId,
    localId,
    serverId,
    createdAt,
    updatedAt,
    attempts,
    [entity+status],
    [businessId+status],
    [status+createdAt]
  `,

  // --------------------------------------------------
  // META – sync state, schema version, flags
  // --------------------------------------------------
  meta: `
    key
  `,
});

// ======================================================
// HELPERS (optional but very useful)
// ======================================================

/**
 * Generate a temporary local ID for offline-created records.
 * Format: local_<timestamp>_<random>
 */
export function createLocalId(prefix = "local") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if an ID is a temporary local ID
 */
export function isLocalId(id) {
  return typeof id === "string" && id.startsWith("local_");
}

/**
 * Standard outbox statuses
 */
export const OUTBOX_STATUS = {
  PENDING: "pending",
  SYNCING: "syncing",
  FAILED: "failed",
  SYNCED: "synced",
};

/**
 * Supported entities that can be mutated offline
 */
export const OUTBOX_ENTITIES = [
  "car",
  "booking",
  "customer",
  "driver",
  "payment",
  "expense",
  "inspection",
  "settings",
];

/**
 * Supported actions
 */
export const OUTBOX_ACTIONS = {
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
};

// ======================================================
// CONVENIENCE ACCESSORS
// ======================================================

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
};

// ======================================================
// DEFAULT EXPORT
// ======================================================

export default db;