/**
 * src/offline/offlineAdapter.js
 *
 * Business- and permission-scoped offline reads/writes over IndexedDB, returning
 * RTK Query-compatible { data } / { error } results. Called by baseApi.js; it never
 * intercepts hooks on its own. All previously exported names are preserved.
 */
import { db, isLocalId, OUTBOX_STATUS } from "./db";
import { createOffline, updateOffline, deleteOffline, getPendingCount, ENTITY_TABLE } from "./outbox";
import { queryRecords, loadLookups, joinBooking } from "./localQuries";

const SUPPORTED_ENTITIES = Object.freeze({
  car: "cars", booking: "bookings", customer: "customers", driver: "drivers",
  payment: "payments", expense: "expenses", inspection: "inspections", settings: "settings",
});

/**
 * Writes that may be queued. Payments, refunds, expenses, inspections (issue/return),
 * uploads, booking cancel/extend stay ONLINE-ONLY until their backend idempotency and
 * validation rules are verified.
 */
const WRITE_PERMISSIONS = Object.freeze({
  car: ["create", "update", "delete"],
  customer: ["create", "update", "delete"],
  driver: ["create", "update", "delete"],
  booking: ["create", "update"],
});

/** Local-only display values so a pending booking renders sensibly. Not sent to the server. */
const LOCAL_DEFAULTS = Object.freeze({
  booking: { status: "reserved", bookingNumber: "Pending sync", _pendingConfirmation: true },
});

const isObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const getId = (v) => (isObject(v) ? v.id ?? v._id ?? null : v ?? null);

// ======================================================
// ERRORS
// ======================================================

export class OfflineAdapterError extends Error {
  constructor(message, status = "CUSTOM_ERROR") {
    super(message);
    this.name = "OfflineAdapterError";
    this.status = status;
  }
}

export const toOfflineError = (error) => ({
  status: error?.status || "CUSTOM_ERROR",
  data: { success: false, message: error?.message || "Offline operation failed." },
  error: error?.message || "Offline operation failed.",
});

const failure = (message, status = "CUSTOM_ERROR") => {
  throw new OfflineAdapterError(message, status);
};

// ======================================================
// ENTITY + CONNECTION HELPERS
// ======================================================

export function getOfflineTableName(entity) {
  const name = SUPPORTED_ENTITIES[entity];
  if (!name || ENTITY_TABLE[entity] !== name) failure(`Unsupported offline entity: ${entity}`);
  return name;
}

export const getOfflineTable = (entity) => db.table(getOfflineTableName(entity));

export const supportsOfflineAction = (entity, action) => Boolean(WRITE_PERMISSIONS[entity]?.includes(action));

export function isBrowserOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

/** Only real connectivity failures. Never 400/401/403/404/409/422/500 server answers. */
export function isNetworkFailure(error) {
  return Boolean(error) && (error.status === "FETCH_ERROR" || error.status === "TIMEOUT_ERROR");
}

export function shouldUseOffline(error = null) {
  return !isBrowserOnline() || isNetworkFailure(error);
}

// ======================================================
// TENANT + PERMISSION GUARDS
// ======================================================

function requireBusinessId(businessId) {
  const id = getId(businessId);
  if (!id || !String(id).trim()) failure("A valid businessId is required for offline access.", 403);
  return String(id);
}

const belongsToBusiness = (record, businessId) => sameId(getId(record?.businessId), businessId);

function requireAccessFilter(accessFilter) {
  if (typeof accessFilter !== "function") failure("Offline access requires a verified permission filter.", 403);
  return accessFilter;
}

// ======================================================
// READS
// ======================================================

export async function readOfflineRecords({ entity, businessId, accessFilter, includeDeleted = false } = {}) {
  const tenantId = requireBusinessId(businessId);
  const allowed = requireAccessFilter(accessFilter);
  const rows = await getOfflineTable(entity).where("businessId").equals(tenantId).toArray();
  return rows.filter(
    (r) => belongsToBusiness(r, tenantId) && (includeDeleted || !r._deleted) && allowed(r) === true
  );
}

export async function readOfflineList({ entity, businessId, params = {}, accessFilter, mapper = (r) => r } = {}) {
  const tenantId = requireBusinessId(businessId);
  const records = await readOfflineRecords({ entity, businessId: tenantId, accessFilter });
  const lookups = entity === "booking" ? await loadLookups(tenantId) : null;
  const result = queryRecords(entity, records, params, lookups);
  return { ...result, items: result.items.map(mapper) };
}

export async function readOfflineRecord({ entity, businessId, id, accessFilter, mapper = (r) => r } = {}) {
  const tenantId = requireBusinessId(businessId);
  const allowed = requireAccessFilter(accessFilter);
  if (!id) failure("Record ID is required.", 400);

  const record = await getOfflineTable(entity).get(String(id));
  if (!record || !belongsToBusiness(record, tenantId)) failure("Record not found or access is not permitted.", 404);
  if (record._deleted) failure("Record has been deleted locally.", 404);
  if (allowed(record) !== true) failure("Access to this record is not permitted.", 403);

  const row = entity === "booking" ? joinBooking(record, await loadLookups(tenantId)) : record;
  return mapper(row);
}

/** Customer + their cached bookings/payments (relationships are partial by nature). */
export async function readOfflineCustomerDetails({
  businessId, id, customerAccessFilter, bookingAccessFilter, paymentAccessFilter, carAccessFilter,
} = {}) {
  const tenantId = requireBusinessId(businessId);
  const customer = await readOfflineRecord({ entity: "customer", businessId: tenantId, id, accessFilter: customerAccessFilter });

  const bookings = (await readOfflineRecords({ entity: "booking", businessId: tenantId, accessFilter: bookingAccessFilter }))
    .filter((b) => sameId(getId(b.customerId), getId(customer)));
  const bookingIds = new Set(bookings.map((b) => String(getId(b))));

  const payments = (await readOfflineRecords({ entity: "payment", businessId: tenantId, accessFilter: paymentAccessFilter }))
    .filter((p) => bookingIds.has(String(getId(p.bookingId))) || sameId(getId(p.customerId), getId(customer)));

  let cars = new Map();
  if (typeof carAccessFilter === "function") {
    const rows = await readOfflineRecords({ entity: "car", businessId: tenantId, accessFilter: carAccessFilter });
    cars = new Map(rows.map((c) => [String(getId(c)), c]));
  }

  return {
    ...customer,
    id: getId(customer),
    bookings: bookings.map((b) => {
      const car = cars.get(String(getId(b.carId)));
      return {
        ...b, id: getId(b),
        number: b.number ?? b.bookingNumber ?? "",
        carName: b.carName ?? car?.name ?? "",
        pickupAt: b.pickupAt ?? b.pickupDate ?? b.startDate,
        returnAt: b.returnAt ?? b.returnDate ?? b.endDate,
        total: b.total ?? b.totalAmount ?? null,
        displayStatus: b.displayStatus ?? b.status,
      };
    }),
    payments: payments.map((p) => ({
      ...p, id: getId(p),
      date: p.date ?? p.paymentDate ?? p.paidAt,
      receiptNo: p.receiptNo ?? p.paymentNumber ?? p.reference ?? "",
    })),
    _offline: true,
    _fromCache: true,
    _relationshipsPartial: true,
  };
}

// ======================================================
// PAYLOAD VALIDATION
// ======================================================

const isBlob = (v) => typeof Blob !== "undefined" && v instanceof Blob;

function containsBinary(value, seen = new WeakSet()) {
  if (!value || typeof value !== "object") return false;
  if (isBlob(value) || (typeof FormData !== "undefined" && value instanceof FormData)) return true;
  if (seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((item) => containsBinary(item, seen));
}

/** A FormData without real files becomes a plain object; any real file is refused offline. */
function formDataToObject(fd) {
  const out = {};
  for (const [key, value] of fd.entries()) {
    if (isBlob(value)) {
      if (value.size > 0) failure("Offline file uploads are not supported. Save this when online.", 400);
      continue; // empty file input
    }
    out[key] = key in out ? [].concat(out[key], value) : value;
  }
  return out;
}

function preparePayload(payload) {
  const body = typeof FormData !== "undefined" && payload instanceof FormData ? formDataToObject(payload) : payload;
  if (!isObject(body)) failure("Offline operation requires a plain object payload.", 400);
  if (containsBinary(body)) failure("Offline file uploads are not supported. Save this when online.", 400);

  const result = { ...body };
  for (const key of ["id", "_id", "businessId", "__v", "_isLocal", "_deleted", "_syncError", "_extraKeys"]) delete result[key];
  return result;
}

function checkWritePermission(entity, action) {
  if (!supportsOfflineAction(entity, action)) failure(`Offline ${action} is not enabled for ${entity}.`, 400);
}

// ======================================================
// WRITES (record + outbox entry in one transaction)
// ======================================================

export async function createOfflineRecord({ entity, businessId, payload, accessFilter, mapper = (r) => r } = {}) {
  const tenantId = requireBusinessId(businessId);
  const allowed = requireAccessFilter(accessFilter);
  checkWritePermission(entity, "create");

  const body = preparePayload(payload);
  if (allowed({ ...body, businessId: tenantId, _isLocal: true }) !== true) {
    failure("Offline create is not permitted for this record.", 403);
  }

  const record = await createOffline(entity, tenantId, body, { extras: LOCAL_DEFAULTS[entity] || {} });
  const shaped = entity === "booking" ? joinBooking(record, await loadLookups(tenantId)) : record;
  return { ...mapper(shaped), _offline: true, _pendingSync: true };
}

export async function updateOfflineRecord({ entity, businessId, id, payload, accessFilter, mapper = (r) => r } = {}) {
  const tenantId = requireBusinessId(businessId);
  checkWritePermission(entity, "update");
  await readOfflineRecord({ entity, businessId: tenantId, id, accessFilter });

  const record = await updateOffline(entity, tenantId, String(id), preparePayload(payload));
  const shaped = entity === "booking" ? joinBooking(record, await loadLookups(tenantId)) : record;
  return { ...mapper(shaped), _offline: true, _pendingSync: true };
}

export async function deleteOfflineRecord({ entity, businessId, id, accessFilter } = {}) {
  const tenantId = requireBusinessId(businessId);
  checkWritePermission(entity, "delete");
  await readOfflineRecord({ entity, businessId: tenantId, id, accessFilter });
  await deleteOffline(entity, tenantId, String(id));
  return { id: String(id), success: true, _offline: true, _pendingSync: true };
}

// ======================================================
// RTK QUERY WRAPPER
// ======================================================

export async function executeOffline(operation) {
  try {
    const { action = "list", entity, businessId, params, id, payload, mapper, accessFilter } = operation || {};
    let data;

    switch (action) {
      case "customerDetails":
        data = await readOfflineCustomerDetails({
          businessId, id,
          customerAccessFilter: operation?.customerAccessFilter ?? accessFilter,
          bookingAccessFilter: operation?.bookingAccessFilter,
          paymentAccessFilter: operation?.paymentAccessFilter,
          carAccessFilter: operation?.carAccessFilter,
        });
        break;
      case "list": data = await readOfflineList({ entity, businessId, params, mapper, accessFilter }); break;
      case "get": data = await readOfflineRecord({ entity, businessId, id, mapper, accessFilter }); break;
      case "create": data = await createOfflineRecord({ entity, businessId, payload, mapper, accessFilter }); break;
      case "update": data = await updateOfflineRecord({ entity, businessId, id, payload, mapper, accessFilter }); break;
      case "delete": data = await deleteOfflineRecord({ entity, businessId, id, accessFilter }); break;
      default: failure(`Unsupported offline operation: ${action}`, 400);
    }
    return { data };
  } catch (error) {
    return { error: toOfflineError(error) };
  }
}

// ======================================================
// PENDING / SYNC HELPERS
// ======================================================

export const getOfflinePendingCount = (businessId) => getPendingCount(requireBusinessId(businessId));

export async function getOfflineRecordStatus({ entity, businessId, id } = {}) {
  const tenantId = requireBusinessId(businessId);
  getOfflineTableName(entity);

  const entries = await db.outbox.where("businessId").equals(tenantId).toArray();
  const active = entries.filter(
    (x) => x.entity === entity && (sameId(x.localId, id) || sameId(x.serverId, id)) && x.status !== OUTBOX_STATUS.SYNCED
  );
  if (!active.length) return { pending: false, status: "synced" };

  const latest = active[active.length - 1];
  return { pending: true, status: latest.status, attempts: latest.attempts || 0, lastError: latest.lastError || null };
}

export function invalidateOfflineTags(
  dispatch,
  baseApi,
  tags = ["Cars", "Customers", "Bookings", "Drivers", "Payments", "Expenses", "Dashboard", "Reports"]
) {
  if (typeof dispatch !== "function" || !baseApi?.util?.invalidateTags) return false;
  dispatch(baseApi.util.invalidateTags(tags));
  return true;
}

export { isLocalId };

const offlineAdapter = {
  isBrowserOnline, isNetworkFailure, shouldUseOffline,
  getOfflineTableName, getOfflineTable, supportsOfflineAction,
  readOfflineRecords, readOfflineList, readOfflineRecord, readOfflineCustomerDetails,
  createOfflineRecord, updateOfflineRecord, deleteOfflineRecord,
  executeOffline, getOfflinePendingCount, getOfflineRecordStatus, invalidateOfflineTags,
};

export default offlineAdapter;