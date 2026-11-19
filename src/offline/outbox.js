/**
 * src/offline/outbox.js
 * Durable, tenant-scoped mutation queue. Record + outbox entry are always committed
 * in ONE Dexie transaction. Compatible with db.js v1/v2.
 */
import { db, createLocalId, isLocalId, OUTBOX_STATUS, OUTBOX_ACTIONS, OUTBOX_ENTITIES } from "./db";

export const MAX_ATTEMPTS = 5;
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

export const ENTITY_TABLE = Object.freeze({
  car: "cars", booking: "bookings", customer: "customers", driver: "drivers",
  payment: "payments", expense: "expenses", inspection: "inspections", settings: "settings",
});

const now = () => new Date().toISOString();
const same = (a, b) => a != null && b != null && String(a) === String(b);

const tableFor = (entity) => {
  const name = ENTITY_TABLE[entity];
  if (!name || !OUTBOX_ENTITIES.includes(entity)) throw new Error(`Unsupported offline entity: ${entity}`);
  return db.table(name);
};

const validate = (entity, action, businessId) => {
  tableFor(entity);
  if (!Object.values(OUTBOX_ACTIONS).includes(action)) throw new Error(`Unsupported offline action: ${action}`);
  if (!businessId) throw new Error("businessId is required");
};

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const newItem = ({ entity, action, businessId, localId = null, serverId = null, payload = {}, fingerprint = null }) => ({
  entity, action, status: OUTBOX_STATUS.PENDING, businessId: String(businessId),
  localId, serverId, payload, fingerprint,
  createdAt: now(), updatedAt: now(), attempts: 0, lastError: null,
});

const ownedBy = (record, businessId) => {
  if (!record || !same(record.businessId, businessId)) throw new Error("Record not found for this business");
};

function cleanChanges(changes) {
  const result = { ...changes };
  for (const key of ["id", "_id", "businessId", "createdAt", "_isLocal", "_deleted", "_syncError", "_extraKeys"]) delete result[key];
  return result;
}

const isOpen = (item) => item.status !== OUTBOX_STATUS.SYNCED;

// ======================================================
// QUEUE API
// ======================================================

export async function addToOutbox({ entity, action, businessId, localId = null, serverId = null, payload = {} }) {
  validate(entity, action, businessId);
  if (!localId && !serverId && action !== OUTBOX_ACTIONS.CREATE) throw new Error("Update/delete needs a record ID");
  const id = localId || (action === OUTBOX_ACTIONS.CREATE ? createLocalId("local") : null);
  return db.outbox.add(newItem({ entity, action, businessId, localId: id, serverId, payload }));
}

export async function getPendingItems(businessId = null) {
  const items = await db.outbox.where("status").anyOf([OUTBOX_STATUS.PENDING, OUTBOX_STATUS.FAILED]).toArray();
  return items
    .filter((x) => !businessId || same(x.businessId, businessId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}

export async function getPendingCount(businessId = null) {
  const items = await db.outbox.where("status").anyOf([OUTBOX_STATUS.PENDING, OUTBOX_STATUS.FAILED, OUTBOX_STATUS.SYNCING]).toArray();
  return items.filter((x) => !businessId || same(x.businessId, businessId)).length;
}

/** Entries that hit the retry limit or need manual reconciliation. */
export async function getHeldItems(businessId) {
  return (await getPendingItems(businessId)).filter((x) => (x.attempts || 0) >= MAX_ATTEMPTS);
}

export async function hasPending(businessId, entity) {
  const items = await db.outbox.where("businessId").equals(String(businessId)).toArray();
  return items.some((x) => x.entity === entity && isOpen(x));
}

export const getOutboxItem = (id) => db.outbox.get(id);
export const markSyncing = (id) => db.outbox.update(id, { status: OUTBOX_STATUS.SYNCING, updatedAt: now() });
export const markSynced = (id, serverId = null) =>
  db.outbox.update(id, { status: OUTBOX_STATUS.SYNCED, ...(serverId ? { serverId: String(serverId) } : {}), updatedAt: now(), lastError: null });

export async function markFailed(id, errorMessage = "", { hold = false } = {}) {
  return db.transaction("rw", db.outbox, async () => {
    const item = await db.outbox.get(id);
    if (!item) return 0;
    return db.outbox.update(id, {
      status: OUTBOX_STATUS.FAILED,
      attempts: hold ? MAX_ATTEMPTS : (item.attempts || 0) + 1,
      lastError: String(errorMessage).slice(0, 500),
      updatedAt: now(),
    });
  });
}

export const retryItem = (id) =>
  db.outbox.update(id, { status: OUTBOX_STATUS.PENDING, attempts: 0, lastError: null, updatedAt: now() });

export async function retryFailedItems(businessId) {
  const items = await getPendingItems(businessId);
  for (const item of items) if (item.status === OUTBOX_STATUS.FAILED) await retryItem(item.id);
  return items.length;
}

export const clearSyncedItems = () => db.outbox.where("status").equals(OUTBOX_STATUS.SYNCED).delete();

/** Dangerous: only after confirming no unsynced changes are needed. Never called automatically. */
export const clearAllOutbox = () => db.outbox.clear();

/**
 * Entries left in SYNCING by a closed tab / crash.
 * - update/delete are idempotent -> retried.
 * - create is only retried automatically when the backend honours Idempotency-Key.
 *   Otherwise it is HELD (the server may already have saved it).
 */
export async function recoverInterruptedItems(businessId, { idempotent = false } = {}) {
  if (!businessId) throw new Error("businessId is required");
  return db.transaction("rw", db.outbox, async () => {
    const items = await db.outbox.where("status").equals(OUTBOX_STATUS.SYNCING).toArray();
    for (const item of items) {
      if (!same(item.businessId, businessId)) continue;
      if (item.action !== OUTBOX_ACTIONS.CREATE || idempotent) {
        await db.outbox.update(item.id, { status: OUTBOX_STATUS.PENDING, updatedAt: now() });
      } else {
        await db.outbox.update(item.id, {
          status: OUTBOX_STATUS.FAILED,
          attempts: MAX_ATTEMPTS,
          lastError: "RECONCILIATION REQUIRED: sync was interrupted and the server may already have saved this record.",
          updatedAt: now(),
        });
      }
    }
  });
}

/** Give up on one failed entry and undo its local effect (create -> remove record, delete -> restore). */
export async function discardItem(id) {
  const item = await db.outbox.get(id);
  if (!item || item.status === OUTBOX_STATUS.SYNCING) return false;
  const table = tableFor(item.entity);
  await db.transaction("rw", table, db.outbox, async () => {
    const key = item.localId || item.serverId;
    if (item.action === OUTBOX_ACTIONS.CREATE && key) await table.delete(key);
    if (item.action === OUTBOX_ACTIONS.DELETE && key) {
      const rec = await table.get(key);
      if (rec) {
        const { _deleted, _syncError, ...rest } = rec;
        await table.put(rest);
      }
    }
    await db.outbox.delete(id);
  });
  return true;
}

// ======================================================
// OFFLINE MUTATIONS
// ======================================================

/**
 * @param extras local-only display defaults (never sent to the server), e.g. a provisional
 *               booking status. They are listed in `_extraKeys` so sync can remove them.
 */
export async function createOffline(entity, businessId, data = {}, { extras = {} } = {}) {
  validate(entity, OUTBOX_ACTIONS.CREATE, businessId);
  if (entity === "payment" && !data.idempotencyKey) throw new Error("Offline payment requires a stable idempotencyKey");

  const table = tableFor(entity);
  const biz = String(businessId);
  const fingerprint = `${entity}|create|${stable(data)}`;

  return db.transaction("rw", table, db.outbox, async () => {
    // Duplicate guard: the same create already waiting in the queue -> reuse it.
    const open = await db.outbox.where("businessId").equals(biz).toArray();
    const dup = open.find(
      (x) => x.entity === entity && x.action === OUTBOX_ACTIONS.CREATE && x.fingerprint === fingerprint &&
        isOpen(x) && Date.now() - Date.parse(x.createdAt) < DEDUPE_WINDOW_MS
    );
    if (dup) {
      const existing = await table.get(dup.localId);
      if (existing) return existing;
    }

    const localId = createLocalId("local");
    const stamp = now();
    const record = {
      ...data, ...extras,
      id: localId, businessId: biz,
      createdAt: data.createdAt || stamp, updatedAt: stamp,
      _isLocal: true,
      ...(Object.keys(extras).length ? { _extraKeys: Object.keys(extras) } : {}),
    };
    await table.put(record);
    await db.outbox.add(newItem({ entity, action: OUTBOX_ACTIONS.CREATE, businessId: biz, localId, payload: { ...data }, fingerprint }));
    return record;
  });
}

export async function updateOffline(entity, businessId, id, changes = {}) {
  validate(entity, OUTBOX_ACTIONS.UPDATE, businessId);
  if (entity === "payment" || entity === "inspection") throw new Error(`${entity} updates are not supported by this offline queue`);

  const table = tableFor(entity);
  const biz = String(businessId);

  return db.transaction("rw", table, db.outbox, async () => {
    const existing = await table.get(id);
    ownedBy(existing, biz);
    if (existing._deleted) throw new Error("Cannot update a deleted record");

    const delta = cleanChanges(changes);
    const updated = { ...existing, ...delta, updatedAt: now() };
    await table.put(updated);

    const entries = (await db.outbox.where("businessId").equals(biz).toArray()).filter(
      (x) => x.entity === entity && (same(x.localId, id) || same(x.serverId, id)) && x.status === OUTBOX_STATUS.PENDING
    );

    // Fold the edit into a not-yet-sent create, or into a not-yet-sent update.
    const create = isLocalId(id) ? entries.filter((x) => x.action === OUTBOX_ACTIONS.CREATE).pop() : null;
    const update = entries.filter((x) => x.action === OUTBOX_ACTIONS.UPDATE).pop();
    const target = create || update;

    if (target) {
      await db.outbox.update(target.id, { payload: { ...target.payload, ...delta }, updatedAt: now() });
    } else {
      await db.outbox.add(newItem({
        entity, action: OUTBOX_ACTIONS.UPDATE, businessId: biz,
        localId: isLocalId(id) ? id : null, serverId: isLocalId(id) ? null : id, payload: delta,
      }));
    }
    return updated;
  });
}

export async function deleteOffline(entity, businessId, id) {
  validate(entity, OUTBOX_ACTIONS.DELETE, businessId);
  if (["payment", "inspection", "settings"].includes(entity)) throw new Error(`Offline delete is not supported for ${entity}`);

  const table = tableFor(entity);
  const biz = String(businessId);

  return db.transaction("rw", table, db.outbox, async () => {
    const existing = await table.get(id);
    if (!existing) return false;
    ownedBy(existing, biz);
    if (existing._deleted) return true;

    const entries = (await db.outbox.where("businessId").equals(biz).toArray()).filter(
      (x) => x.entity === entity && (same(x.localId, id) || same(x.serverId, id)) && isOpen(x)
    );

    // A create that never left the device can simply be discarded.
    if (isLocalId(id) && entries.some((x) => x.action === OUTBOX_ACTIONS.CREATE && x.status === OUTBOX_STATUS.PENDING) &&
        entries.every((x) => x.status === OUTBOX_STATUS.PENDING)) {
      await db.outbox.bulkDelete(entries.map((x) => x.id));
      await table.delete(id);
      return true;
    }

    // Unsent edits are pointless once the record is deleted.
    const droppable = entries.filter((x) => x.action === OUTBOX_ACTIONS.UPDATE && x.status === OUTBOX_STATUS.PENDING);
    if (droppable.length) await db.outbox.bulkDelete(droppable.map((x) => x.id));

    // Tombstone stops a server pull from restoring a pending delete.
    await table.put({ ...existing, _deleted: true, updatedAt: now() });
    await db.outbox.add(newItem({
      entity, action: OUTBOX_ACTIONS.DELETE, businessId: biz,
      localId: isLocalId(id) ? id : null, serverId: isLocalId(id) ? null : id, payload: { id },
    }));
    return true;
  });
}