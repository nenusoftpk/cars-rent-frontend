/**
 * src/offline/syncEngine.js
 *
 * Push the tenant's outbox (dependency order, temp-ID -> server-ID mapping) then pull
 * fresh authorized records. Never overwrites records that still have pending changes.
 *
 * BACKEND NOTES
 *  - Exactly-once creates need an `Idempotency-Key` header on the backend. Until then
 *    (NEXT_PUBLIC_BACKEND_IDEMPOTENCY !== "true") an ambiguous create (timeout/5xx/crash)
 *    is HELD for reconciliation instead of being retried blindly.
 *  - Pull is ADMIN-only: entity tables are tenant-wide and must never be filled with
 *    employee-scoped rows or shown to a different user.
 */
import { db, isLocalId, OUTBOX_STATUS, getIdMap, idMapKey } from "./db";
import {
  ENTITY_TABLE, MAX_ATTEMPTS, getPendingItems, getPendingCount, markSyncing, markFailed,
  recoverInterruptedItems,
} from "./outbox";
import { mergeServerRecords, markHydrated, stripSensitive } from "./queryCache";

const PAGE_SIZE = 100;
const MAX_PAGES = 5000;
const MIN_PULL_INTERVAL_MS = 2 * 60 * 1000;
const IDEMPOTENT = process.env.NEXT_PUBLIC_BACKEND_IDEMPOTENCY === "true";
const PRUNE = process.env.NEXT_PUBLIC_OFFLINE_PRUNE_DELETED === "true";

const now = () => new Date().toISOString();
const same = (a, b) => a != null && b != null && String(a) === String(b);
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    const id = value.id ?? value._id;
    return id == null ? null : String(id);
  }
  return null;
};

const API = {
  car: "/cars", booking: "/bookings", customer: "/customers", driver: "/drivers",
  payment: "/payments", expense: "/expenses", inspection: "/inspections", settings: "/settings",
};
const REFERENCE_KEYS = ["customerId", "carId", "driverId", "bookingId", "employeeId", "originalPaymentId"];
const ALL_TABLES = ["cars", "bookings", "customers", "drivers", "payments", "expenses", "inspections", "settings"];
const CREATE_RANK = { customer: 0, car: 1, driver: 2, booking: 3, payment: 4, inspection: 5, expense: 6, settings: 7 };
const PERMANENT_STATUS = new Set([400, 403, 404, 409, 413, 422]);
const AMBIGUOUS_STATUS = new Set([408, 502, 503, 504]);

const join = (base, path) => `${base.replace(/\/+$/, "")}${path}`;

// ======================================================
// HTTP
// ======================================================

function networkError(error) {
  const err = new Error(`Network error: ${error?.message || "Request failed"}`);
  err.networkFailure = true;
  return err;
}

async function request(url, { token, method = "GET", body, idempotencyKey, timeoutMs = 20000 } = {}) {
  const headers = { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (idempotencyKey && IDEMPOTENT) headers["Idempotency-Key"] = idempotencyKey;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    // Same CORS mode as RTK Query's fetchBaseQuery (no credentials:'include').
    response = await fetch(url, { method, headers, signal: controller.signal, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  } catch (error) {
    throw networkError(error);
  } finally {
    clearTimeout(timer);
  }

  let json = null;
  try { json = await response.json(); } catch { json = null; }

  if (!response.ok || json?.success === false) {
    const err = new Error(json?.message || json?.error || `HTTP ${response.status}: ${url}`);
    err.status = response.status;
    throw err;
  }
  return json?.data !== undefined ? json.data : json;
}

/** Reachability + authorization in one call (GET /auth/me with the current token). */
export async function probeBackend({ baseUrl, token, timeoutMs = 8000 }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(join(baseUrl, "/auth/me"), {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    return { reachable: !AMBIGUOUS_STATUS.has(res.status), authorized: res.ok, status: res.status };
  } catch {
    return { reachable: false, authorized: false, status: 0 };
  } finally {
    clearTimeout(timer);
  }
}

// ======================================================
// LIST DOWNLOAD
// ======================================================

function extractList(data, path) {
  const list = Array.isArray(data) ? data : data?.items ?? data?.records ?? data?.results;
  if (!Array.isArray(list)) throw new Error(`Unexpected list response for ${path}; check backend response shape`);
  return { list, pagination: data?.pagination || data?.meta || null };
}

async function fetchAll(baseUrl, token, path) {
  const all = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await request(`${join(baseUrl, path)}?page=${page}&limit=${PAGE_SIZE}`, { token });
    const { list, pagination } = extractList(data, path);
    if (!list.length) return all;

    let added = 0;
    for (const row of list) {
      const id = idOf(row);
      if (id && seen.has(id)) continue;
      if (id) seen.add(id);
      all.push(row);
      added++;
    }

    const totalPages = Number(pagination?.totalPages || pagination?.pages || 0);
    const total = Number(pagination?.total || 0);
    if (totalPages > 0 && page >= totalPages) return all;
    if (total > 0 && all.length >= total) return all;
    if (!pagination && list.length < PAGE_SIZE) return all;
    if (added === 0) throw new Error(`${path}: pagination repeated the same records on page ${page}`);
  }
  throw new Error(`${path}: exceeded pagination safety limit`);
}

// ======================================================
// PUSH HELPERS
// ======================================================

function blocked(message) {
  const err = new Error(message);
  err.blocked = true;
  return err;
}

function resolveReference(value, resolve, key) {
  const id = idOf(value);
  if (!id || !isLocalId(id)) return value;
  const mapped = resolve(id);
  if (!mapped) throw blocked(`Waiting for ${key}=${id} to synchronize first`);
  return mapped;
}

function payloadFor(item, resolve) {
  const body = { ...(item.payload || {}) };
  for (const key of ["id", "_id", "businessId", "createdAt", "updatedAt", "_isLocal", "_deleted", "_syncError", "_extraKeys", "__v"]) delete body[key];
  for (const key of REFERENCE_KEYS) {
    if (body[key] == null || body[key] === "") continue;
    body[key] = resolveReference(body[key], resolve, key);
  }
  return body;
}

function configFor(item, resolve) {
  const path = API[item.entity];
  if (!path) throw new Error(`Unknown entity: ${item.entity}`);

  const body = payloadFor(item, resolve);
  const serverId = item.serverId || (item.localId ? resolve(item.localId) : null);
  const needsServerId = () => {
    if (!serverId) {
      if (item.localId && isLocalId(item.localId)) throw blocked(`Waiting for ${item.entity} ${item.localId} to be created first`);
      throw new Error(`Missing server ID for ${item.entity} ${item.action}`);
    }
  };

  if (item.action === "create") {
    if (item.entity === "settings") throw new Error("Settings create endpoint is not configured");
    if (item.entity === "inspection") return { path: body.type === "return" ? "/inspections/return" : "/inspections/issue", method: "POST", body };
    if (item.entity === "payment" && !body.idempotencyKey) throw new Error("Payment idempotencyKey is required");
    return { path, method: "POST", body };
  }

  if (item.action === "update") {
    if (item.entity === "payment" || item.entity === "inspection") throw new Error(`Unsupported ${item.entity} update`);
    if (item.entity === "settings") return { path, method: "PATCH", body };
    needsServerId();
    return { path: `${path}/${encodeURIComponent(serverId)}`, method: "PATCH", body };
  }

  if (item.action === "delete") {
    if (["payment", "inspection", "settings"].includes(item.entity)) throw new Error(`Unsupported ${item.entity} delete`);
    needsServerId();
    if (item.entity === "booking") {
      return { path: `${path}/${encodeURIComponent(serverId)}/cancel`, method: "PATCH", body: { reason: item.payload?.cancellationReason || "Cancelled while offline" } };
    }
    return { path: `${path}/${encodeURIComponent(serverId)}`, method: "DELETE" };
  }

  throw new Error(`Unsupported action: ${item.action}`);
}

function extractRecord(result, entity) {
  if (!isObj(result)) return null;
  for (const key of [entity, "item", "record", "data"]) {
    if (isObj(result[key]) && idOf(result[key])) return result[key];
  }
  return idOf(result) ? result : null;
}

function repointRecord(record, oldId, newId) {
  let changed = false;
  const next = { ...record };
  for (const key of REFERENCE_KEYS) {
    if (next[key] == null || !same(idOf(next[key]), oldId)) continue;
    next[key] = isObj(next[key]) ? { ...next[key], id: newId, _id: newId } : newId;
    changed = true;
  }
  return changed ? next : record;
}

async function repointLocalReferences(businessId, oldId, newId) {
  const biz = String(businessId);
  for (const name of ALL_TABLES) {
    const table = db.table(name);
    for (const record of await table.where("businessId").equals(biz).toArray()) {
      const updated = repointRecord(record, oldId, newId);
      if (updated !== record) await table.put(updated);
    }
  }
  for (const entry of await db.outbox.where("businessId").equals(biz).toArray()) {
    if (entry.status === OUTBOX_STATUS.SYNCED) continue;
    const updates = {};
    if (same(entry.localId, oldId)) updates.serverId = newId;
    if (entry.payload) {
      const payload = repointRecord(entry.payload, oldId, newId);
      if (payload !== entry.payload) updates.payload = payload;
    }
    if (Object.keys(updates).length) await db.outbox.update(entry.id, updates);
  }
}

async function finalizePush(item, serverId, mapping, serverRecord) {
  const table = db.table(ENTITY_TABLE[item.entity]);
  const involved = [...new Set([table, db.outbox, db.meta, ...ALL_TABLES.map((n) => db.table(n))])];

  await db.transaction("rw", ...involved, async () => {
    if (item.action === "create" && item.localId && serverId) {
      const local = await table.get(item.localId);
      const base = { ...(local || {}) };
      for (const key of base._extraKeys || []) delete base[key]; // provisional display values
      delete base._extraKeys;
      delete base._syncError;

      const server = serverRecord ? stripSensitive(serverRecord) : {};
      await table.put({ ...base, ...server, id: String(serverId), businessId: String(item.businessId), _isLocal: false });
      if (!same(item.localId, serverId)) {
        await table.delete(item.localId);
        await repointLocalReferences(item.businessId, item.localId, String(serverId));
      }
      mapping[item.localId] = String(serverId);
      await db.meta.put({ key: idMapKey(item.businessId), value: { ...mapping } });
    }

    if (item.action === "delete") {
      const keys = new Set([item.localId, item.serverId, item.localId && mapping[item.localId]].filter(Boolean));
      for (const key of keys) await table.delete(key); // removes the tombstone, whichever ID it carries
    }

    await db.outbox.update(item.id, {
      status: OUTBOX_STATUS.SYNCED,
      serverId: serverId || item.serverId || null,
      lastError: null,
      updatedAt: now(),
    });
  });
}

/** A permanent server rejection must not leave a hidden tombstone or a silent failure. */
async function applyPermanentFailure(item, message, mapping) {
  const table = db.table(ENTITY_TABLE[item.entity]);
  const keys = new Set([item.localId, item.serverId, item.localId && mapping[item.localId]].filter(Boolean));
  await db.transaction("rw", table, async () => {
    for (const key of keys) {
      const rec = await table.get(key);
      if (!rec) continue;
      if (item.action === "delete" && rec._deleted) {
        const { _deleted, ...rest } = rec;
        await table.put({ ...rest, _syncError: message });
      } else {
        await table.put({ ...rec, _syncError: message });
      }
    }
  });
}

const keyFor = (item) => `rac:${item.businessId}:${item.id}`;

async function pushOutbox({ baseUrl, token, businessId, onProgress }) {
  const mapping = await getIdMap(businessId);
  const resolve = (id) => mapping[id] || null;

  const phase = (item) => (item.action === "create" ? 0 : item.action === "update" ? 1 : 2);
  const items = (await getPendingItems(businessId)).sort(
    (a, b) => phase(a) - phase(b) || (phase(a) === 0 ? (CREATE_RANK[a.entity] ?? 99) - (CREATE_RANK[b.entity] ?? 99) : 0) || a.id - b.id
  );

  const out = { pushed: 0, failed: 0, authFailed: false, stopped: false };

  for (const item of items) {
    if ((item.attempts || 0) >= MAX_ATTEMPTS) { out.failed++; continue; }

    let config;
    try {
      config = configFor(item, resolve);
    } catch (error) {
      out.failed++;
      if (!error.blocked) await markFailed(item.id, error.message, { hold: true });
      continue;
    }

    try {
      await markSyncing(item.id);
      const result = await request(join(baseUrl, config.path), { token, method: config.method, body: config.body, idempotencyKey: keyFor(item) });
      const record = extractRecord(result, item.entity);
      const serverId = idOf(record) || idOf(result) || item.serverId || (item.localId && resolve(item.localId)) || null;

      if (item.action === "create" && !serverId) {
        const err = new Error(`${item.entity} created but API returned no ID; verify on the server before retrying`);
        err.ambiguous = true;
        throw err;
      }

      await finalizePush(item, serverId, mapping, record);
      out.pushed++;
      onProgress?.({ type: "push", item, success: true });
    } catch (error) {
      out.failed++;
      onProgress?.({ type: "push", item, success: false, error });

      if (error.status === 401) {
        await db.outbox.update(item.id, { status: OUTBOX_STATUS.PENDING, updatedAt: now() });
        out.authFailed = true;
        break; // the whole session is invalid; stop without burning attempts
      }
      if (item.action === "delete" && error.status === 404) {
        await finalizePush(item, item.serverId, mapping, null); // already gone: success
        out.failed--; out.pushed++;
        continue;
      }
      if (error.networkFailure || AMBIGUOUS_STATUS.has(error.status) || error.ambiguous) {
        if (item.action === "create" && !IDEMPOTENT) {
          await markFailed(item.id, `RECONCILIATION REQUIRED: the server may have accepted this request. ${error.message || ""}`, { hold: true });
        } else {
          await db.outbox.update(item.id, { status: OUTBOX_STATUS.PENDING, lastError: error.message, updatedAt: now() });
        }
        out.stopped = true; // connectivity/server problem: do not hammer the remaining items
        break;
      }
      if (PERMANENT_STATUS.has(error.status)) {
        await markFailed(item.id, error.message, { hold: true });
        await applyPermanentFailure(item, error.message, mapping);
        continue;
      }
      await markFailed(item.id, error.message || "Sync failed"); // e.g. 500: retry later, counted
    }
  }
  return out;
}

// ======================================================
// PULL
// ======================================================

const RESOURCES = [
  ["cars", "/cars", true],
  ["customers", "/customers", true],
  ["drivers", "/drivers", true],
  ["bookings", "/bookings", true],
  ["payments", "/payments", false], // optional: a 403 must not abort the rest
  ["expenses", "/expenses", false],
];

async function pullLatest({ baseUrl, token, businessId }) {
  const counts = {};
  const errors = [];

  for (const [table, path, required] of RESOURCES) {
    try {
      const rows = await fetchAll(baseUrl, token, path);
      counts[table] = await mergeServerRecords(table, rows, businessId, { prune: PRUNE });
      if (required) await markHydrated(businessId, table);
    } catch (error) {
      if (error.status === 401) throw error;
      if (required) errors.push(`${path}: ${error.message}`);
    }
  }

  try {
    const setting = await request(join(baseUrl, "/settings"), { token });
    if (isObj(setting)) {
      await mergeServerRecords("settings", [{ ...setting, id: idOf(setting) || String(businessId) }], businessId);
    }
  } catch (error) {
    if (error.status === 401) throw error;
  }

  if (!errors.length) {
    const ts = now();
    await db.meta.put({ key: `lastSyncAt:${businessId}`, value: ts });
    await db.meta.put({ key: "lastSyncAt", value: ts });
  }
  return { counts, errors };
}

// ======================================================
// ORCHESTRATION
// ======================================================

function fail(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

async function executeSync({ baseUrl, token, businessId, isAdmin = true, force = false, onProgress = null }) {
  if (!baseUrl || !token || !businessId) throw fail("BAD_ARGS", "baseUrl, token and businessId are required");
  if (typeof navigator !== "undefined" && !navigator.onLine) throw fail("UNREACHABLE", "Device is offline");

  const probe = await probeBackend({ baseUrl, token });
  if (!probe.reachable) throw fail("UNREACHABLE", "The server cannot be reached");
  if (!probe.authorized) {
    throw fail(probe.status === 401 || probe.status === 403 ? "UNAUTHORIZED" : "REJECTED",
      probe.status === 401 ? "Session expired. Please log in again." : `The server rejected this session (${probe.status}).`);
  }

  await recoverInterruptedItems(businessId, { idempotent: IDEMPOTENT });

  const push = await pushOutbox({ baseUrl, token, businessId, onProgress });
  let pull = null;
  let pullError = null;

  if (isAdmin && !push.authFailed && !push.stopped) {
    const last = Date.parse((await db.meta.get(`lastSyncAt:${businessId}`))?.value || "") || 0;
    const due = force || push.pushed > 0 || Date.now() - last > MIN_PULL_INTERVAL_MS;
    if (due) {
      try {
        pull = await pullLatest({ baseUrl, token, businessId });
        if (pull.errors.length) pullError = pull.errors.join("; ");
      } catch (error) {
        pullError = error.message;
      }
    }
  }

  const pending = await getPendingCount(businessId);
  const failed = push.failed + (pullError ? 1 : 0);
  const lastSyncAt = (await db.meta.get(`lastSyncAt:${businessId}`))?.value || null;

  return {
    success: failed === 0 && pending === 0,
    pushed: push.pushed,
    failed,
    pending,
    lastSyncAt,
    pulled: pull?.counts || null,
    pullError,
    authFailed: push.authFailed,
  };
}

const IN_FLIGHT = new Map();

/** One sync per business per tab, and (where supported) one per browser via Web Locks. */
export function runSync(options) {
  const key = String(options?.businessId || "");
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const exec = async () => {
    if (typeof navigator !== "undefined" && navigator.locks?.request) {
      return navigator.locks.request(`rac-sync-${key}`, { ifAvailable: true }, async (lock) =>
        lock ? executeSync(options) : { skipped: true }
      );
    }
    return executeSync(options);
  };

  const promise = exec().finally(() => IN_FLIGHT.delete(key));
  IN_FLIGHT.set(key, promise);
  return promise;
}

export const syncIfNeeded = (options) => runSync(options);