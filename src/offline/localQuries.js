/**
 * src/offline/localQueries.js
 *
 * Pure, CarsRent-specific query logic over IndexedDB rows (search, filters, dates, sort,
 * pagination, booking joins). No sales/products/inventory logic.
 * Tenant + permission checks live in offlineAdapter.js; this file never reads across tenants.
 */
import { db } from "./db";

export const TABLE = Object.freeze({
  car: "cars",
  customer: "customers",
  driver: "drivers",
  booking: "bookings",
});

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const idOf = (v) => {
  if (v == null) return null;
  if (isObj(v)) {
    const id = v.id ?? v._id;
    return id == null ? null : String(id);
  }
  return String(v);
};
const norm = (v) => String(v ?? "").trim().toLowerCase();
const enumOf = (v) => norm(v).replace(/[\s-]+/g, "_");
const asText = (v) => (typeof v === "string" || typeof v === "number" ? String(v) : "");

// ======================================================
// SEARCH + FILTER DEFINITIONS (real CarsRent fields)
// ======================================================

const SEARCH = {
  car: (r) => [r.name, r.brand, r.model, `${r.brand ?? ""} ${r.model ?? ""}`, r.numberPlate, r.plate, r.color],
  customer: (r) => [r.name, r.phone, r.mobile, r.email, r.cnic, r.customerCode, r.city],
  driver: (r) => [r.name, r.phone, r.mobile, r.licenseNo, r.licenseNumber, r.cnic],
  booking: (r) => {
    const c = isObj(r.customerId) ? r.customerId : {};
    const k = isObj(r.carId) ? r.carId : {};
    return [r.bookingNumber, r.number, r.invoiceNumber, r.invoiceNo, c.name, c.phone, c.mobile, c.cnic, k.name, k.numberPlate, k.plate];
  },
};

// [query param, record field, comparison kind]
const FILTERS = {
  car: [["status", "status", "enum"], ["brand", "brand", "enum"], ["fuelType", "fuelType", "enum"], ["fuel", "fuelType", "enum"], ["transmission", "transmission", "enum"]],
  customer: [["status", "status", "enum"], ["type", "type", "enum"], ["city", "city", "enum"]],
  driver: [["status", "status", "enum"], ["paymentType", "paymentType", "enum"]],
  booking: [["status", "status", "enum"], ["customerId", "customerId", "id"], ["carId", "carId", "id"], ["driverId", "driverId", "id"], ["employeeId", "employeeId", "id"]],
};

function matchesSearch(entity, record, search) {
  const q = norm(search);
  if (!q) return true;
  return (SEARCH[entity]?.(record) || []).some((value) => norm(asText(value)).includes(q));
}

function matchesFilters(entity, record, params) {
  for (const [param, field, kind] of FILTERS[entity] || []) {
    const want = params[param];
    if (want === undefined || want === "" || norm(want) === "all") continue;
    if (kind === "id") {
      if (idOf(record[field]) !== String(want)) return false;
    } else if (enumOf(record[field]) !== enumOf(want)) {
      return false;
    }
  }
  return true;
}

/** Bookings: from/to filter the PICK-UP date (the backend default) unless dateField=createdAt. */
function matchesDates(record, params) {
  const from = params.from ?? params.fromDate;
  const to = params.to ?? params.toDate;
  if (!from && !to) return true;

  const field = params.dateField === "createdAt" ? "createdAt" : "pickupDate";
  const t = Date.parse(record[field]);
  if (!Number.isFinite(t)) return false;

  if (from) {
    const f = Date.parse(from);
    if (Number.isFinite(f) && t < f) return false;
  }
  if (to) {
    const e = Date.parse(to);
    if (Number.isFinite(e)) {
      const end = /^\d{4}-\d{2}-\d{2}$/.test(to) ? e + 86400000 : e + 1;
      if (t >= end) return false;
    }
  }
  return true;
}

// ======================================================
// SORT + PAGINATION
// ======================================================

const SORT_ALIAS = { number: "bookingNumber", pickupAt: "pickupDate", returnAt: "returnDate", total: "totalAmount", plate: "numberPlate", mobile: "phone" };

function sortValue(record, field) {
  if (field === "customerName") return isObj(record.customerId) ? record.customerId.name : record.customerName;
  if (field === "carName") return isObj(record.carId) ? record.carId.name : record.carName;
  if (field === "name" && !record.name) return `${record.brand ?? ""} ${record.model ?? ""}`.trim();
  return record[field];
}

function parseSort(params) {
  const raw = String(params.sort || params.sortBy || "");
  let field = "createdAt";
  let dir = "desc";
  if (raw.startsWith("-")) {
    field = raw.slice(1);
  } else if (raw) {
    const [f, d] = raw.split(":");
    field = f || field;
    dir = norm(d || params.sortOrder || "asc");
  }
  return { field: SORT_ALIAS[field] || field, mult: dir === "asc" ? 1 : -1 };
}

const compare = (a, b) => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};

function sortRows(rows, params) {
  const { field, mult } = parseSort(params);
  return [...rows].sort((x, y) => {
    const a = sortValue(x, field);
    const b = sortValue(y, field);
    if (a == null && b == null) return 0;
    if (a == null) return 1; // missing values last, whatever the direction
    if (b == null) return -1;
    return compare(a, b) * mult || compare(y.createdAt ?? "", x.createdAt ?? "");
  });
}

const toInt = (value, fallback, max) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback;
};

// ======================================================
// BOOKING JOINS (customer / car / driver names for offline rows)
// ======================================================

const byId = (rows) => new Map(rows.map((row) => [String(row.id), row]));

export async function loadLookups(businessId) {
  const read = (name) => db.table(name).where("businessId").equals(String(businessId)).toArray();
  const [customers, cars, drivers] = await Promise.all([read("customers"), read("cars"), read("drivers")]);
  return { customers: byId(customers), cars: byId(cars), drivers: byId(drivers) };
}

const brief = {
  customer: (c) => ({ id: c.id, _id: c.id, name: c.name, phone: c.phone, mobile: c.mobile ?? c.phone, email: c.email, photo: c.photo }),
  car: (c) => ({ id: c.id, _id: c.id, name: c.name ?? [c.brand, c.model].filter(Boolean).join(" "), numberPlate: c.numberPlate, plate: c.plate ?? c.numberPlate, image: c.image, images: c.images }),
  driver: (d) => ({ id: d.id, _id: d.id, name: d.name, phone: d.phone }),
};

/**
 * Populate customerId / carId / driverId like the backend does, so mapBooking() shows names.
 * The stored row keeps plain IDs (so sync can still repoint temporary IDs).
 */
export function joinBooking(booking, lookups) {
  if (!lookups) return booking;
  const link = (field, map, shape) => {
    if (isObj(booking[field])) return booking[field];
    const found = map.get(String(booking[field]));
    return found ? shape(found) : booking[field];
  };
  return {
    ...booking,
    customerId: link("customerId", lookups.customers, brief.customer),
    carId: link("carId", lookups.cars, brief.car),
    driverId: booking.driverId ? link("driverId", lookups.drivers, brief.driver) : booking.driverId,
  };
}

// ======================================================
// PUBLIC QUERY
// ======================================================

export function queryRecords(entity, records, params = {}, lookups = null) {
  let rows = entity === "booking" ? records.map((r) => joinBooking(r, lookups)) : records;

  rows = rows.filter(
    (r) =>
      matchesSearch(entity, r, params.search) &&
      matchesFilters(entity, r, params) &&
      (entity !== "booking" || matchesDates(r, params))
  );

  rows = sortRows(rows, params);

  const page = toInt(params.page, 1, 100000);
  const limit = toInt(params.limit ?? params.pageSize, 10, 3000);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return {
    items: rows.slice((page - 1) * limit, page * limit),
    pagination: { page, limit, total, totalPages },
    page,
    pageSize: limit,
    total,
    totalPages,
    _offline: true,
  };
}