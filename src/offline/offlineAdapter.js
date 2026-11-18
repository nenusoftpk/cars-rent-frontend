/**
 * src/offline/offlineAdapter.js
 *
 * Offline adapter for Rent-a-Car SaaS.
 *
 * Uses:
 * - Dexie / IndexedDB (db.js)
 * - Existing outbox.js
 * - Existing syncEngine.js
 *
 * Features:
 * - Business-scoped cached reads
 * - Searching, filtering, sorting, pagination
 * - Offline create, update and delete
 * - RTK Query-compatible { data } / { error } results
 * - No direct changes to page components
 *
 * IMPORTANT:
 * This module must be called by the RTK Query API layer.
 * It does not automatically intercept existing API hooks.
 */

import { db, isLocalId } from "./db";

import {
    createOffline,
    updateOffline,
    deleteOffline,
    getPendingCount,
    ENTITY_TABLE,
} from "./outbox";

// ======================================================
// CONFIGURATION
// ======================================================

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 3000;

const SUPPORTED_ENTITIES = Object.freeze({
    car: "cars",
    booking: "bookings",
    customer: "customers",
    driver: "drivers",
    payment: "payments",
    expense: "expenses",
    inspection: "inspections",
    settings: "settings",
});

// These are the operations that this adapter can safely
// queue using the currently available outbox functions.
//
// Booking creation is allowed as a LOCAL DRAFT. The backend
// must still approve availability during synchronization.
//
// Financial and inspection writes require separate,
// verified server-specific implementations.
const WRITE_PERMISSIONS = Object.freeze({
    car: ["create", "update", "delete"],
    customer: ["create", "update", "delete"],
    driver: ["create", "update", "delete"],
    booking: ["create", "update"],
    expense: ["create", "update", "delete"],
    payment: ["create"],
    inspection: ["create"],
    settings: ["update"],
});

const now = () => new Date().toISOString();

const sameId = (a, b) =>
    a != null &&
    b != null &&
    String(a) === String(b);

const isObject = (value) =>
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value);

const getId = (value) => {
    if (isObject(value)) {
        return value.id ?? value._id ?? null;
    }

    return value ?? null;
};

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const toPositiveInteger = (value, fallback, max) => {
    const number = Number.parseInt(value, 10);

    if (!Number.isFinite(number) || number < 1) {
        return fallback;
    }

    return Math.min(number, max);
};

// ======================================================
// ERROR HANDLING
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
    data: {
        success: false,
        message: error?.message || "Offline operation failed.",
    },
    error: error?.message || "Offline operation failed.",
});

const failure = (message, status = "CUSTOM_ERROR") => {
    throw new OfflineAdapterError(message, status);
};

// ======================================================
// ENTITY HELPERS
// ======================================================

export function getOfflineTableName(entity) {
    const name = SUPPORTED_ENTITIES[entity];

    if (!name || ENTITY_TABLE[entity] !== name) {
        failure(`Unsupported offline entity: ${entity}`);
    }

    return name;
}

export function getOfflineTable(entity) {
    return db.table(getOfflineTableName(entity));
}

export function supportsOfflineAction(entity, action) {
    return Boolean(
        WRITE_PERMISSIONS[entity]?.includes(action)
    );
}

// ======================================================
// CONNECTION HELPERS
// ======================================================

export function isBrowserOnline() {
    if (typeof navigator === "undefined") {
        return true;
    }

    return navigator.onLine;
}

/**
 * navigator.onLine is only a connection hint.
 * It does not guarantee the backend is reachable.
 *
 * The API layer must distinguish network failures from
 * HTTP validation, authentication and permission errors.
 */
export function isNetworkFailure(error) {
    if (!error) return false;

    const status = error.status;

    return (
        status === "FETCH_ERROR" ||
        status === "TIMEOUT_ERROR"
    );
}

/**
 * Decide whether the API layer may use offline storage.
 *
 * Never turn a backend 400/401/403/404/500 response
 * into a successful offline mutation.
 */
export function shouldUseOffline(error = null) {
    if (!isBrowserOnline()) {
        return true;
    }

    return isNetworkFailure(error);
}

// ======================================================
// BUSINESS SECURITY
// ======================================================

function requireBusinessId(businessId) {
    const id = getId(businessId);

    if (!id || !String(id).trim()) {
        failure(
            "A valid businessId is required for offline access.",
            403
        );
    }

    return String(id);
}

function belongsToBusiness(record, businessId) {
    return sameId(
        getId(record?.businessId),
        businessId
    );
}

function assertOwned(record, businessId) {
    if (!record || !belongsToBusiness(record, businessId)) {
        failure(
            "Record not found or access is not permitted.",
            404
        );
    }
}

/**
 * This adapter enforces business isolation only.
 *
 * Employee dataScope and permission filtering must be
 * supplied by the authenticated API integration.
 *
 * Do not enable offline access for shared-device users
 * without a verified user-scoped cache policy.
 */
function requireAccessFilter(accessFilter) {
    if (typeof accessFilter !== "function") {
        failure(
            "Offline access requires a verified permission filter.",
            403
        );
    }

    return accessFilter;
}

// ======================================================
// FILTER HELPERS
// ======================================================

function normalize(value) {
    return String(value ?? "")
        .trim()
        .toLowerCase();
}

function getSearchableValue(value) {
    if (value == null) return "";

    if (
        typeof value === "string" ||
        typeof value === "number"
    ) {
        return String(value);
    }

    return "";
}

const SEARCH_FIELDS = Object.freeze({
    car: [
        "name",
        "brand",
        "model",
        "numberPlate",
        "plate",
        "color",
    ],
    customer: [
        "name",
        "phone",
        "mobile",
        "email",
        "cnic",
        "customerCode",
        "city",
    ],
    driver: [
        "name",
        "phone",
        "mobile",
        "licenseNumber",
        "cnic",
    ],
    booking: [
        "bookingNumber",
        "invoiceNumber",
        "customerName",
        "carName",
        "number",
    ],
    payment: [
        "paymentNumber",
        "receiptNo",
        "reference",
    ],
    expense: [
        "category",
        "title",
        "description",
        "notes",
    ],
    inspection: [
        "notes",
        "condition",
    ],
    settings: [],
});

function matchesSearch(record, search, entity) {
    const query = normalize(search);

    if (!query) return true;

    const fields = SEARCH_FIELDS[entity] || [];

    return fields.some((field) =>
        normalize(
            getSearchableValue(record[field])
        ).includes(query)
    );
}

const FILTER_ALIASES = Object.freeze({
    car: {
        plate: "numberPlate",
        fuel: "fuelType",
    },
    booking: {
        number: "bookingNumber",
    },
});

const RESERVED_PARAMS = new Set([
    "page",
    "limit",
    "pageSize",
    "search",
    "sort",
    "sortBy",
    "sortOrder",
    "view",
    "layout",
    "from",
    "to",
    "fromDate",
    "toDate",
    "dateField",
]);

function matchesFilters(record, params, entity) {
    const aliases = FILTER_ALIASES[entity] || {};

    for (const [key, value] of Object.entries(params)) {
        if (RESERVED_PARAMS.has(key)) continue;

        if (
            value === undefined ||
            value === null ||
            value === ""
        ) {
            continue;
        }

        const field = aliases[key] || key;

        const actual = getId(record[field]);
        const expected = getId(value);

        if (Array.isArray(expected)) {
            if (!expected.some((x) => sameId(actual, x))) {
                return false;
            }
            continue;
        }

        if (normalize(actual) !== normalize(expected)) {
            return false;
        }
    }

    return true;
}

function matchesDateRange(record, params) {
    const from = params.from ?? params.fromDate;
    const to = params.to ?? params.toDate;

    if (!from && !to) return true;

    const field =
        params.dateField ||
        (record.pickupDate !== undefined
            ? "pickupDate"
            : record.expenseDate !== undefined
                ? "expenseDate"
                : "createdAt");

    const dateValue = record[field];

    if (!dateValue) return false;

    const timestamp = new Date(dateValue).getTime();

    if (!Number.isFinite(timestamp)) return false;

    if (from) {
        const fromTime = new Date(from).getTime();

        if (!Number.isFinite(fromTime)) {
            failure("Invalid From date.", 400);
        }

        if (timestamp < fromTime) return false;
    }

    if (to) {
        const toTime = new Date(to).getTime();

        if (!Number.isFinite(toTime)) {
            failure("Invalid To date.", 400);
        }

        const endTime =
            typeof to === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(to)
                ? toTime + 86400000
                : toTime;

        if (timestamp >= endTime) return false;
    }

    return true;
}

function sortRecords(records, params = {}) {
    const sortValue = String(
        params.sort || params.sortBy || "createdAt:desc"
    );

    const [rawField, rawDirection] = sortValue.split(":");

    const field = rawField || "createdAt";

    const direction = normalize(
        rawDirection || params.sortOrder || "desc"
    );

    const multiplier = direction === "asc" ? 1 : -1;

    return [...records].sort((a, b) => {
        const av = a[field];
        const bv = b[field];

        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;

        if (
            typeof av === "number" &&
            typeof bv === "number"
        ) {
            return (av - bv) * multiplier;
        }

        return (
            String(av).localeCompare(
                String(bv),
                undefined,
                { numeric: true, sensitivity: "base" }
            ) * multiplier
        );
    });
}

// ======================================================
// READ ALL RECORDS
// ======================================================

export async function readOfflineRecords({
    entity,
    businessId,
    accessFilter,
    includeDeleted = false,
} = {}) {
    const tenantId = requireBusinessId(businessId);
    const permissionFilter = requireAccessFilter(accessFilter);
    const table = getOfflineTable(entity);

    const records = await table
        .where("businessId")
        .equals(tenantId)
        .toArray();

    return records.filter((record) => {
        if (!belongsToBusiness(record, tenantId)) {
            return false;
        }

        if (!includeDeleted && record._deleted) {
            return false;
        }

        return permissionFilter(record) === true;
    });
}

// ======================================================
// READ PAGINATED LIST
// ======================================================

export async function readOfflineList({
    entity,
    businessId,
    params = {},
    accessFilter,
    mapper = (record) => record,
} = {}) {
    const records = await readOfflineRecords({
        entity,
        businessId,
        accessFilter,
    });

    const filtered = records.filter(
        (record) =>
            matchesSearch(record, params.search, entity) &&
            matchesFilters(record, params, entity) &&
            matchesDateRange(record, params)
    );

    const sorted = sortRecords(filtered, params);

    const page = toPositiveInteger(
        params.page,
        DEFAULT_PAGE,
        100000
    );

    const limit = toPositiveInteger(
        params.limit ?? params.pageSize,
        DEFAULT_LIMIT,
        MAX_LIMIT
    );

    const total = sorted.length;
    const totalPages = Math.max(
        1,
        Math.ceil(total / limit)
    );

    const start = (page - 1) * limit;

    const items = sorted
        .slice(start, start + limit)
        .map(mapper);

    const pagination = {
        page,
        limit,
        total,
        totalPages,
    };

    return {
        items,
        pagination,
        page,
        pageSize: limit,
        total,
        totalPages,
        _offline: true,
    };
}

// ======================================================
// READ SINGLE RECORD
// ======================================================

export async function readOfflineRecord({
    entity,
    businessId,
    id,
    accessFilter,
    mapper = (record) => record,
} = {}) {
    const tenantId = requireBusinessId(businessId);
    const permissionFilter = requireAccessFilter(accessFilter);

    if (!id) {
        failure("Record ID is required.", 400);
    }

    const table = getOfflineTable(entity);
    const record = await table.get(String(id));

    assertOwned(record, tenantId);

    if (record._deleted) {
        failure("Record has been deleted locally.", 404);
    }

    if (permissionFilter(record) !== true) {
        failure("Access to this record is not permitted.", 403);
    }

    return mapper(record);
}



/**
 * Read customer details, bookings and payments
 * from IndexedDB while offline.
 *
 * Each related entity requires its own verified
 * permission filter.
 */
export async function readOfflineCustomerDetails({
    businessId,
    id,
    customerAccessFilter,
    bookingAccessFilter,
    paymentAccessFilter,
    carAccessFilter,
} = {}) {
    const tenantId = requireBusinessId(businessId);

    const customer = await readOfflineRecord({
        entity: "customer",
        businessId: tenantId,
        id,
        accessFilter: customerAccessFilter,
    });

    const bookings = (
        await readOfflineRecords({
            entity: "booking",
            businessId: tenantId,
            accessFilter: bookingAccessFilter,
        })
    ).filter((booking) =>
        sameId(
            getId(booking.customerId),
            getId(customer)
        )
    );

    const bookingIds = new Set(
        bookings.map((booking) => String(getId(booking)))
    );

    const payments = (
        await readOfflineRecords({
            entity: "payment",
            businessId: tenantId,
            accessFilter: paymentAccessFilter,
        })
    ).filter(
        (payment) =>
            bookingIds.has(String(getId(payment.bookingId))) ||
            sameId(
                getId(payment.customerId),
                getId(customer)
            )
    );

    let carsById = new Map();

    if (typeof carAccessFilter === "function") {
        const cars = await readOfflineRecords({
            entity: "car",
            businessId: tenantId,
            accessFilter: carAccessFilter,
        });

        carsById = new Map(
            cars.map((car) => [String(getId(car)), car])
        );
    }

    const mappedBookings = bookings.map((booking) => {
        const car = carsById.get(
            String(getId(booking.carId))
        );

        return {
            ...booking,
            id: getId(booking),
            number:
                booking.number ??
                booking.bookingNumber ??
                "",
            carName:
                booking.carName ??
                car?.name ??
                "",
            pickupAt:
                booking.pickupAt ??
                booking.pickupDate ??
                booking.startDate,
            returnAt:
                booking.returnAt ??
                booking.returnDate ??
                booking.endDate,
            total:
                booking.total ??
                booking.totalAmount ??
                null,
            displayStatus:
                booking.displayStatus ??
                booking.status,
        };
    });

    const mappedPayments = payments.map((payment) => ({
        ...payment,
        id: getId(payment),
        date:
            payment.date ??
            payment.paymentDate ??
            payment.paidAt,
        receiptNo:
            payment.receiptNo ??
            payment.paymentNumber ??
            payment.reference ??
            "",
    }));

    return {
        ...customer,
        id: getId(customer),
        bookings: mappedBookings,
        payments: mappedPayments,
        _offline: true,
        _fromCache: true,
        _relationshipsPartial: true,
    };
}


// ======================================================
// PAYLOAD VALIDATION
// ======================================================

function containsBinary(value, visited = new WeakSet()) {
    if (!value || typeof value !== "object") {
        return false;
    }

    if (
        (typeof Blob !== "undefined" &&
            value instanceof Blob) ||
        (typeof File !== "undefined" &&
            value instanceof File) ||
        (typeof FormData !== "undefined" &&
            value instanceof FormData)
    ) {
        return true;
    }

    if (visited.has(value)) return false;
    visited.add(value);

    return Object.values(value).some((item) =>
        containsBinary(item, visited)
    );
}

function preparePayload(payload) {
    if (!isObject(payload)) {
        failure(
            "Offline operation requires a plain object payload.",
            400
        );
    }

    if (containsBinary(payload)) {
        failure(
            "Offline file uploads are not configured. Save this operation when online.",
            400
        );
    }

    const result = { ...payload };

    for (const key of [
        "id",
        "_id",
        "businessId",
        "__v",
        "_isLocal",
        "_deleted",
    ]) {
        delete result[key];
    }

    return result;
}

function checkWritePermission(entity, action) {
    if (!supportsOfflineAction(entity, action)) {
        failure(
            `Offline ${action} is not enabled for ${entity}.`,
            400
        );
    }
}

// ======================================================
// OFFLINE CREATE
// ======================================================


export async function createOfflineRecord({
    entity,
    businessId,
    payload,
    accessFilter,
    mapper = (record) => record,
} = {}) {
    const tenantId = requireBusinessId(businessId);
    const permissionFilter = requireAccessFilter(accessFilter);

    checkWritePermission(entity, "create");

    const body = preparePayload(payload);

    // Check local visibility before creating
    // the IndexedDB record and outbox entry.
    const candidate = {
        ...body,
        businessId: tenantId,
        _isLocal: true,
    };

    if (permissionFilter(candidate) !== true) {
        failure(
            "Offline create is not permitted for this record.",
            403
        );
    }

    const record = await createOffline(
        entity,
        tenantId,
        body
    );

    return {
        ...mapper(record),
        _offline: true,
        _pendingSync: true,
    };
}


// ======================================================
// OFFLINE UPDATE
// ======================================================

export async function updateOfflineRecord({
    entity,
    businessId,
    id,
    payload,
    accessFilter,
    mapper = (record) => record,
} = {}) {
    const tenantId = requireBusinessId(businessId);

    checkWritePermission(entity, "update");

    await readOfflineRecord({
        entity,
        businessId: tenantId,
        id,
        accessFilter,
    });

    const body = preparePayload(payload);

    const record = await updateOffline(
        entity,
        tenantId,
        String(id),
        body
    );

    return {
        ...mapper(record),
        _offline: true,
        _pendingSync: true,
    };
}

// ======================================================
// OFFLINE DELETE
// ======================================================

export async function deleteOfflineRecord({
    entity,
    businessId,
    id,
    accessFilter,
} = {}) {
    const tenantId = requireBusinessId(businessId);

    checkWritePermission(entity, "delete");

    await readOfflineRecord({
        entity,
        businessId: tenantId,
        id,
        accessFilter,
    });

    await deleteOffline(
        entity,
        tenantId,
        String(id)
    );

    return {
        id: String(id),
        success: true,
        _offline: true,
        _pendingSync: true,
    };
}

// ======================================================
// RTK QUERY RESPONSE WRAPPER
// ======================================================

/**
 * RTK Query baseQuery/queryFn expects:
 *
 * Success:
 *   { data: result }
 *
 * Failure:
 *   { error: { status, data, error } }
 */
export async function executeOffline(operation) {
    try {
        const {
            action = "list",
            entity,
            businessId,
            params,
            id,
            payload,
            mapper,
            accessFilter,
        } = operation || {};

        let data;

        switch (action) {

            case "customerDetails":
                data = await readOfflineCustomerDetails({
                    businessId,
                    id,
                    customerAccessFilter:
                        operation?.customerAccessFilter ?? accessFilter,
                    bookingAccessFilter:
                        operation?.bookingAccessFilter,
                    paymentAccessFilter:
                        operation?.paymentAccessFilter,
                    carAccessFilter:
                        operation?.carAccessFilter,
                });
                break;

            case "list":
                data = await readOfflineList({
                    entity,
                    businessId,
                    params,
                    mapper,
                    accessFilter,
                });
                break;

            case "get":
                data = await readOfflineRecord({
                    entity,
                    businessId,
                    id,
                    mapper,
                    accessFilter,
                });
                break;

            case "create":
                data = await createOfflineRecord({
                    entity,
                    businessId,
                    payload,
                    mapper,
                    accessFilter,
                });
                break;

            case "update":
                data = await updateOfflineRecord({
                    entity,
                    businessId,
                    id,
                    payload,
                    mapper,
                    accessFilter,
                });
                break;

            case "delete":
                data = await deleteOfflineRecord({
                    entity,
                    businessId,
                    id,
                    accessFilter,
                });
                break;

            default:
                failure(
                    `Unsupported offline operation: ${action}`,
                    400
                );
        }

        return { data };
    } catch (error) {
        return {
            error: toOfflineError(error),
        };
    }
}

// ======================================================
// PENDING SYNC HELPERS
// ======================================================

export async function getOfflinePendingCount(businessId) {
    const tenantId = requireBusinessId(businessId);

    return getPendingCount(tenantId);
}

export async function getOfflineRecordStatus({
    entity,
    businessId,
    id,
} = {}) {
    const tenantId = requireBusinessId(businessId);

    getOfflineTableName(entity);

    const entries = await db.outbox
        .where("businessId")
        .equals(tenantId)
        .toArray();

    const matching = entries.filter(
        (item) =>
            item.entity === entity &&
            (
                sameId(item.localId, id) ||
                sameId(item.serverId, id)
            )
    );

    const active = matching.filter(
        (item) => item.status !== "synced"
    );

    if (!active.length) {
        return {
            pending: false,
            status: "synced",
        };
    }

    const latest = active[active.length - 1];

    return {
        pending: true,
        status: latest.status,
        attempts: latest.attempts || 0,
        lastError: latest.lastError || null,
    };
}

// ======================================================
// SYNC UTILITIES
// ======================================================

/**
 * Allows the API integration to refresh RTK Query
 * after syncEngine.runSync() finishes.
 *
 * Pass the Redux dispatch and the existing baseApi
 * object from the calling layer.
 */
export function invalidateOfflineTags(
    dispatch,
    baseApi,
    tags = [
        "Cars",
        "Customers",
        "Bookings",
        "Drivers",
        "Payments",
        "Expenses",
        "Dashboard",
        "Reports",
    ]
) {
    if (
        typeof dispatch !== "function" ||
        !baseApi?.util?.invalidateTags
    ) {
        return false;
    }

    dispatch(
        baseApi.util.invalidateTags(tags)
    );

    return true;
}

// ======================================================
// DEFAULT EXPORT
// ======================================================

const offlineAdapter = {
    isBrowserOnline,
    isNetworkFailure,
    shouldUseOffline,

    getOfflineTableName,
    getOfflineTable,
    supportsOfflineAction,

    readOfflineRecords,
    readOfflineList,
    readOfflineRecord,
    readOfflineCustomerDetails,

    createOfflineRecord,
    updateOfflineRecord,
    deleteOfflineRecord,

    executeOffline,

    getOfflinePendingCount,
    getOfflineRecordStatus,

    invalidateOfflineTags,
};

export default offlineAdapter;