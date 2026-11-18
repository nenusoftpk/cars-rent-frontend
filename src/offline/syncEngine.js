
/**
 * src/offline/syncEngine.js
 * Tenant-scoped IndexedDB outbox push + paginated backend pull.
 * Compatible with the existing Dexie v1 schema and outbox.js exports.
 *
 * IMPORTANT:
 * - Backend must support the listed routes and return an ID for creates.
 * - For exactly-once writes, backend must enforce idempotency keys.
 * - Ambiguous network failures are held for manual reconciliation, not blindly retried.
 * - This file cannot authorize offline access; enforce user/employee scope in the API layer.
 */
import { db, isLocalId, OUTBOX_STATUS } from './db';
import {
  ENTITY_TABLE,
  getPendingItems,
  getPendingCount,
  markSyncing,
  markFailed,
  recoverInterruptedItems,
} from './outbox';
import { getLastSyncAt } from './cache';

const PAGE_SIZE = 100;
const MAX_PAGES = 10000;
const MAX_ATTEMPTS = 5;
const IN_FLIGHT = new Map();
const now = () => new Date().toISOString();
const same = (a, b) => a != null && b != null && String(a) === String(b);
const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (typeof value === 'object') {
    const id = value.id ?? value._id;
    return id == null ? null : String(id);
  }
  return null;
};

const API = {
  car: '/cars',
  booking: '/bookings',
  customer: '/customers',
  driver: '/drivers',
  payment: '/payments',
  expense: '/expenses',
  inspection: '/inspections',
  settings: '/settings',
};

const REFERENCE_KEYS = [
  'customerId',
  'carId',
  'driverId',
  'bookingId',
  'employeeId',
  'originalPaymentId',
];

const RELATED_TABLES = [
  'cars',
  'bookings',
  'customers',
  'drivers',
  'payments',
  'expenses',
  'inspections',
  'settings',
];

const SYNCED = OUTBOX_STATUS.SYNCED ?? 'synced';
const isPendingEntry = (entry) => entry.status !== SYNCED;

function join(base, path) {
  return `${base.replace(/\/+$/, '')}${path}`;
}

function networkError(error) {
  const err = new Error(`Network error: ${error?.message || 'Request failed'}`);
  err.networkFailure = true;
  return err;
}

async function request(url, { token, method = 'GET', body } = {}) {
  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: 'include',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    throw networkError(error);
  }

  let json;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok || json?.success === false) {
    const err = new Error(
      json?.message || json?.error || `HTTP ${response.status}: ${url}`
    );
    err.status = response.status;
    throw err;
  }

  return json?.data !== undefined ? json.data : json;
}

function extractList(data, path) {
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.results)
          ? data.results
          : null;

  if (!list) {
    throw new Error(`Unexpected list response for ${path}; check backend response shape`);
  }

  return { list, pagination: data?.pagination || data?.meta || null };
}

async function fetchAll(baseUrl, token, path) {
  const all = [];
  const seen = new Set();

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL(
      join(baseUrl, path),
      typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('limit', String(PAGE_SIZE));

    const data = await request(url.toString(), { token });
    const { list, pagination } = extractList(data, path);
    let newCount = 0;

    for (const row of list) {
      const id = idOf(row);
      if (id && seen.has(id)) continue;
      all.push(row);
      newCount++;
      if (id) seen.add(id);
    }

    const totalPages = Number(pagination?.totalPages || pagination?.pages || 0);
    const total = Number(pagination?.total || 0);

    if (totalPages > 0 && page >= totalPages) return all;
    if (total > 0 && page * PAGE_SIZE >= total) return all;
    if (list.length < PAGE_SIZE) return all;
    if (newCount === 0) {
      throw new Error(`${path}: pagination repeated the same records on page ${page}`);
    }
  }

  throw new Error(`${path}: exceeded pagination safety limit`);
}

function resolveReference(value, resolve, key) {
  const id = idOf(value);
  if (!id || !isLocalId(id)) return value;
  const mapped = resolve(id);
  if (!mapped) throw new Error(`Dependency ${key}=${id} has not synchronized yet`);
  return mapped;
}

function payloadFor(item, resolve) {
  const body = { ...(item.payload || {}) };
  for (const key of [
    'id',
    '_id',
    'businessId',
    'createdAt',
    'updatedAt',
    '_isLocal',
    '_deleted',
    '__v',
  ]) {
    delete body[key];
  }

  for (const key of REFERENCE_KEYS) {
    if (body[key] == null || body[key] === '') continue;
    body[key] = resolveReference(body[key], resolve, key);
  }

  return body;
}

function configFor(item, resolve) {
  const path = API[item.entity];
  if (!path) throw new Error(`Unknown entity: ${item.entity}`);

  const body = payloadFor(item, resolve);
  const serverId = item.serverId || (item.localId ? resolve(item.localId) : null);

  if (item.action === 'create') {
    if (item.entity === 'settings') {
      throw new Error('Settings create endpoint is not configured');
    }
    if (item.entity === 'inspection') {
      return {
        path: body.type === 'return' ? '/inspections/return' : '/inspections/issue',
        method: 'POST',
        body,
      };
    }
    if (item.entity === 'payment' && !body.idempotencyKey) {
      throw new Error('Payment idempotencyKey is required');
    }
    return { path, method: 'POST', body };
  }

  if (item.action === 'update') {
    if (item.entity === 'payment' || item.entity === 'inspection') {
      throw new Error(`Unsupported ${item.entity} update`);
    }
    if (item.entity === 'settings') {
      return { path, method: 'PATCH', body };
    }
    if (!serverId) throw new Error(`Missing server ID for ${item.entity} update`);
    return {
      path: `${path}/${encodeURIComponent(serverId)}`,
      method: 'PATCH',
      body,
    };
  }

  if (item.action === 'delete') {
    if (['payment', 'inspection', 'settings'].includes(item.entity)) {
      throw new Error(`Unsupported ${item.entity} delete`);
    }
    if (!serverId) throw new Error(`Missing server ID for ${item.entity} delete`);
    if (item.entity === 'booking') {
      return {
        path: `${path}/${encodeURIComponent(serverId)}/cancel`,
        method: 'PATCH',
        body: {
          reason: item.payload?.cancellationReason || 'Cancelled while offline',
        },
      };
    }
    return { path: `${path}/${encodeURIComponent(serverId)}`, method: 'DELETE' };
  }

  throw new Error(`Unsupported action: ${item.action}`);
}

async function readMapping(businessId) {
  const row = await db.meta.get(`sync:idmap:${businessId}`);
  return row?.value || {};
}

function replaceReference(value, oldId, newId) {
  const valueId = idOf(value);
  if (!same(valueId, oldId)) return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return { ...value, id: newId, _id: newId };
  }
  return newId;
}

function replaceReferencesInObject(record, oldId, newId) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
  let changed = false;
  const next = { ...record };

  for (const key of REFERENCE_KEYS) {
    if (next[key] == null) continue;
    const replacement = replaceReference(next[key], oldId, newId);
    if (replacement !== next[key]) {
      next[key] = replacement;
      changed = true;
    }
  }

  return changed ? next : record;
}

async function repointLocalReferences(businessId, oldId, newId) {
  for (const tableName of RELATED_TABLES) {
    const table = db.table(tableName);
    const records = await table.where('businessId').equals(String(businessId)).toArray();

    for (const record of records) {
      const updated = replaceReferencesInObject(record, oldId, newId);
      if (updated !== record) await table.put(updated);
    }
  }

  const waiting = await db.outbox.where('businessId').equals(String(businessId)).toArray();
  for (const entry of waiting) {
    if (!isPendingEntry(entry)) continue;
    const updates = {};

    if (same(entry.localId, oldId)) updates.serverId = newId;
    if (entry.payload) {
      const payload = replaceReferencesInObject(entry.payload, oldId, newId);
      if (payload !== entry.payload) updates.payload = payload;
    }
    if (Object.keys(updates).length) await db.outbox.update(entry.id, updates);
  }
}

async function finalizePush(item, serverId, mapping) {
  const table = db.table(ENTITY_TABLE[item.entity]);
  const transactionTables = [
    table,
    db.outbox,
    db.meta,
    ...RELATED_TABLES.map((name) => db.table(name)),
  ];
  const uniqueTables = [...new Set(transactionTables)];

  await db.transaction('rw', ...uniqueTables, async () => {
    if (item.action === 'create' && item.localId && serverId) {
      const local = await table.get(item.localId);
      if (local) {
        await table.put({ ...local, id: serverId, _isLocal: false });
        if (!same(item.localId, serverId)) await table.delete(item.localId);
      }

      if (!same(item.localId, serverId)) {
        await repointLocalReferences(item.businessId, item.localId, serverId);
      }

      mapping[item.localId] = serverId;
      await db.meta.put({
        key: `sync:idmap:${item.businessId}`,
        value: { ...mapping },
      });
    }

    if (item.action === 'delete') {
      const key = item.localId || item.serverId;
      if (key) await table.delete(key);
    }

    await db.outbox.update(item.id, {
      status: SYNCED,
      serverId: serverId || item.serverId || null,
      lastError: null,
      updatedAt: now(),
    });
  });
}

function isAmbiguousWriteFailure(error) {
  return error?.networkFailure === true ||
    error?.status === 408 ||
    error?.status === 502 ||
    error?.status === 503 ||
    error?.status === 504;
}

async function holdForReconciliation(item, error) {
  const message =
    `RECONCILIATION REQUIRED: The server may have accepted this request. ` +
    `Verify the server record before retrying. ${error.message || ''}`;
  await db.outbox.update(item.id, {
    status: OUTBOX_STATUS.FAILED ?? 'failed',
    attempts: MAX_ATTEMPTS,
    lastError: message,
    updatedAt: now(),
  });
}

async function pushOutbox({ baseUrl, token, businessId, onProgress }) {
  const mapping = await readMapping(businessId);
  const resolve = (id) => mapping[id] || null;
  const items = await getPendingItems(businessId);
  let pushed = 0;
  let failed = 0;

  const rank = {
    customer: 0,
    car: 1,
    driver: 2,
    booking: 3,
    payment: 4,
    inspection: 5,
    expense: 6,
    settings: 7,
  };

  items.sort((a, b) => {
    if (a.action === 'create' && b.action === 'create') {
      return (rank[a.entity] ?? 99) - (rank[b.entity] ?? 99) || a.id - b.id;
    }
    return a.id - b.id;
  });

  for (const item of items) {
    if ((item.attempts || 0) >= MAX_ATTEMPTS) {
      failed++;
      continue;
    }

    try {
      const config = configFor(item, resolve);
      await markSyncing(item.id);

      const result = await request(join(baseUrl, config.path), {
        token,
        method: config.method,
        body: config.body,
      });

      const serverId =
        idOf(result) ||
        idOf(result?.item) ||
        idOf(result?.record) ||
        item.serverId ||
        null;

      if (item.action === 'create' && !serverId) {
        const error = new Error(
          `${item.entity} created but API did not return an ID; verify on server before retrying`
        );
        error.ambiguous = true;
        throw error;
      }

      await finalizePush(item, serverId, mapping);
      pushed++;
      onProgress?.({ type: 'push', item, success: true });
    } catch (error) {
      if (error?.ambiguous || isAmbiguousWriteFailure(error)) {
        await holdForReconciliation(item, error);
      } else {
        await markFailed(item.id, error.message || 'Sync failed');
      }
      failed++;
      onProgress?.({ type: 'push', item, success: false, error });
    }
  }

  return { pushed, failed };
}

function normalize(row, businessId) {
  const id = idOf(row);
  if (!id) throw new Error('Server record missing ID');

  const rowBusiness = idOf(row.businessId) || String(businessId);
  if (!same(rowBusiness, businessId)) {
    throw new Error('Server returned a record from a different business');
  }

  return {
    ...row,
    id,
    businessId: String(businessId),
    _isLocal: false,
  };
}

async function mergeCollection(tableName, records, businessId) {
  const table = db.table(tableName);
  await db.transaction('rw', table, db.outbox, async () => {
    const pending = await db.outbox
      .where('businessId')
      .equals(String(businessId))
      .toArray();

    const protectedIds = new Set();
    for (const entry of pending) {
      if (ENTITY_TABLE[entry.entity] !== tableName || !isPendingEntry(entry)) continue;
      if (entry.localId) protectedIds.add(String(entry.localId));
      if (entry.serverId) protectedIds.add(String(entry.serverId));
    }

    const toPut = records
      .map((record) => normalize(record, businessId))
      .filter((record) => !protectedIds.has(record.id));

    if (toPut.length) await table.bulkPut(toPut);
    // Do not remove missing server rows without a verified full snapshot or tombstones.
  });
}

async function pullLatest({ baseUrl, token, businessId }) {
  const paths = [
    ['cars', '/cars'],
    ['bookings', '/bookings'],
    ['customers', '/customers'],
    ['drivers', '/drivers'],
    ['payments', '/payments'],
    ['expenses', '/expenses'],
  ];

  const downloaded = [];
  for (const [table, path] of paths) {
    const records = await fetchAll(baseUrl, token, path);
    downloaded.push([table, records]);
  }

  for (const [table, records] of downloaded) {
    await mergeCollection(table, records, businessId);
  }

  try {
    const setting = await request(join(baseUrl, '/settings'), { token });
    if (setting && !Array.isArray(setting)) {
      await mergeCollection(
        'settings',
        [{ ...setting, id: idOf(setting) || String(businessId) }],
        businessId
      );
    }
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const timestamp = now();
  await db.meta.put({ key: `lastSyncAt:${businessId}`, value: timestamp });
  await db.meta.put({ key: 'lastSyncAt', value: timestamp });

  return Object.fromEntries(
    downloaded.map(([table, records]) => [table, records.length])
  );
}

async function executeSync({
  baseUrl,
  token,
  businessId,
  dispatch = null,
  onProgress = null,
}) {
  if (!baseUrl || !token || !businessId) {
    throw new Error('baseUrl, token and businessId are required');
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Device is offline');
  }

  dispatch?.({ type: 'sync/setSyncStatus', payload: 'syncing' });

  try {
    await recoverInterruptedItems(businessId);

    const push = await pushOutbox({
      baseUrl,
      token,
      businessId,
      onProgress,
    });

    const counts = await pullLatest({ baseUrl, token, businessId });
    const pending = await getPendingCount(businessId);
    const success = push.failed === 0 && pending === 0;

    dispatch?.({
      type: 'sync/setSyncStatus',
      payload: success ? 'synced' : 'pending',
    });

    return {
      success,
      pushed: push.pushed,
      failed: push.failed,
      pending,
      lastSyncAt: await getLastSyncAt(),
      pulled: counts,
    };
  } catch (error) {
    dispatch?.({ type: 'sync/setSyncStatus', payload: 'failed' });
    throw error;
  }
}

export function runSync(options) {
  const key = String(options?.businessId || '');
  if (IN_FLIGHT.has(key)) return IN_FLIGHT.get(key);

  const promise = executeSync(options).finally(() => IN_FLIGHT.delete(key));
  IN_FLIGHT.set(key, promise);
  return promise;
}

export function syncIfNeeded(options) {
  return runSync(options);
}
