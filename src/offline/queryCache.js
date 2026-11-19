/**
 * src/offline/queryCache.js
 *
 *  1. API response snapshots, isolated by businessId + userId.
 *  2. Merge of server records into entity tables WITHOUT touching unsynchronized changes.
 *  3. "Hydrated" markers: an entity table is only trusted for local queries after a full download.
 *
 * Sensitive keys (passwords, tokens, OTPs...) are stripped before anything is stored.
 * NOTE: IndexedDB is not encrypted by the browser. See the security notes in the README.
 */
import { db, OUTBOX_STATUS } from "./db";

const MAX_ENTRIES = 300;
const SENSITIVE_KEY = /^(password|passwordhash|passwordresettoken|resettoken|token|accesstoken|refreshtoken|otp|secret|apikey)$/i;

export function stripSensitive(value, depth = 0) {
  if (value === null || typeof value !== "object") return value;
  if (value instanceof Date) return value.toISOString();
  if (depth > 12) return undefined;
  if (Array.isArray(value)) return value.map((item) => stripSensitive(item, depth + 1));

  const out = {};
  for (const key of Object.keys(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const cleaned = stripSensitive(value[key], depth + 1);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  return out;
}

const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === "object") {
    const id = value.id ?? value._id;
    return id == null ? null : String(id);
  }
  return String(value);
};

// ======================================================
// SNAPSHOTS
// ======================================================

export function snapshotKey(ctx, request) {
  const query = Object.keys(request.params || {})
    .sort()
    .map((key) => `${key}=${request.params[key]}`)
    .join("&");
  return `${ctx.businessId}|${ctx.userId}|${request.path}${query ? `?${query}` : ""}`;
}

let writes = 0;

export async function saveSnapshot(ctx, request, data) {
  await db.queryCache.put({
    key: snapshotKey(ctx, request),
    businessId: ctx.businessId,
    userId: ctx.userId,
    path: request.path,
    data: stripSensitive(data),
    updatedAt: Date.now(),
  });

  if (++writes % 25 === 0) await pruneSnapshots();
}

export async function readSnapshot(ctx, request) {
  const row = await db.queryCache.get(snapshotKey(ctx, request));
  if (!row || row.businessId !== ctx.businessId || row.userId !== ctx.userId) return null;
  return row;
}

export async function pruneSnapshots() {
  const count = await db.queryCache.count();
  if (count <= MAX_ENTRIES) return;
  const keys = await db.queryCache.orderBy("updatedAt").limit(count - MAX_ENTRIES).primaryKeys();
  await db.queryCache.bulkDelete(keys);
}

/** After a successful online write, drop snapshots that may now be stale (keeps me/settings/staff). */
export async function dropStaleSnapshots(ctx) {
  const keep = new Set(["/auth/me", "/settings", "/staff"]);
  const keys = await db.queryCache
    .where("[businessId+userId]")
    .equals([ctx.businessId, ctx.userId])
    .filter((row) => !keep.has(row.path))
    .primaryKeys();
  if (keys.length) await db.queryCache.bulkDelete(keys);
}

export async function dropSnapshot(ctx, request) {
  await db.queryCache.delete(snapshotKey(ctx, request));
}

/** Explicit wipe (never called automatically on logout). Business records/outbox are untouched. */
export async function clearSnapshots({ businessId, userId } = {}) {
  if (businessId && userId) {
    const keys = await db.queryCache.where("[businessId+userId]").equals([businessId, userId]).primaryKeys();
    return db.queryCache.bulkDelete(keys);
  }
  return db.queryCache.clear();
}

// ======================================================
// SERVER RECORD MERGE
// ======================================================

export function normalizeServerRecord(row, businessId) {
  const id = idOf(row);
  if (!id) return null;
  const rowBusiness = idOf(row.businessId);
  if (rowBusiness && rowBusiness !== String(businessId)) return null; // never accept another tenant's row
  return { ...stripSensitive(row), id, businessId: String(businessId), _isLocal: false };
}

async function protectedIds(tableName, businessId) {
  const entries = await db.outbox.where("businessId").equals(String(businessId)).toArray();
  const ids = new Set();
  for (const entry of entries) {
    if (entry.status === OUTBOX_STATUS.SYNCED) continue;
    const table = { car: "cars", booking: "bookings", customer: "customers", driver: "drivers", payment: "payments", expense: "expenses", inspection: "inspections", settings: "settings" }[entry.entity];
    if (table !== tableName) continue;
    if (entry.localId) ids.add(String(entry.localId));
    if (entry.serverId) ids.add(String(entry.serverId));
  }
  return ids;
}

/**
 * Upsert server rows. Records with pending local changes are never overwritten.
 * Existing local fields are kept (shallow merge) so a partial list response can't erase data.
 * Returns the number of rows written.
 */
export async function mergeServerRecords(tableName, rows, businessId, { prune = false } = {}) {
  const table = db.table(tableName);
  const records = rows.map((row) => normalizeServerRecord(row, businessId)).filter(Boolean);

  return db.transaction("rw", table, db.outbox, async () => {
    const protect = await protectedIds(tableName, businessId);
    const fresh = records.filter((record) => !protect.has(record.id));
    const existing = await table.bulkGet(fresh.map((record) => record.id));
    await table.bulkPut(fresh.map((record, index) => ({ ...(existing[index] || {}), ...record })));

    if (prune) {
      const seen = new Set(records.map((record) => record.id));
      const all = await table.where("businessId").equals(String(businessId)).toArray();
      const gone = all
        .filter((row) => !seen.has(row.id) && !row._isLocal && !protect.has(row.id))
        .map((row) => row.id);
      if (gone.length) await table.bulkDelete(gone);
    }
    return fresh.length;
  });
}

// ======================================================
// HYDRATION MARKERS
// ======================================================

const hydratedKey = (businessId, table) => `hydrated:${businessId}:${table}`;

export const markHydrated = (businessId, table) =>
  db.meta.put({ key: hydratedKey(businessId, table), value: new Date().toISOString() });

export async function isHydrated(businessId, table) {
  return Boolean(await db.meta.get(hydratedKey(businessId, table)));
}