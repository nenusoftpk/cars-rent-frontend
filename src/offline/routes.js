/**
 * src/offline/routes.js
 * Request parsing + classification shared by baseApi, snapshots and local queries.
 */
import { isLocalId } from "./db";

export function normalizePath(url) {
  const raw = String(url || "").split("?")[0];
  try {
    if (/^https?:\/\//i.test(raw)) {
      return new URL(raw).pathname.replace(/^\/api\/v1/, "").replace(/\/+$/, "") || "/";
    }
  } catch {
    // fall through
  }
  return raw.replace(/^\/api\/v1/, "").replace(/\/+$/, "") || "/";
}

export function parseRequest(args) {
  const req = typeof args === "string" ? { url: args, method: "GET" } : args || {};
  const method = String(req.method || "GET").toUpperCase();
  const raw = String(req.url || "");
  const [, query = ""] = raw.split("?");
  const path = normalizePath(raw);
  const params = {};

  const put = (key, value) => {
    if (value === undefined || value === null || value === "") return;
    params[key] = Array.isArray(value) ? value.join(",") : String(value);
  };

  new URLSearchParams(query).forEach((value, key) => put(key, value));
  if (req.params && typeof req.params === "object") {
    for (const [key, value] of Object.entries(req.params)) put(key, value);
  }

  return {
    method,
    path,
    segments: path.split("/").filter(Boolean),
    params,
    body: req.body,
  };
}

const ENTITY_BY_ROOT = Object.freeze({
  cars: "car",
  customers: "customer",
  drivers: "driver",
  bookings: "booking",
});

/** Actions that may be queued offline. Everything else stays online-only. */
export const OFFLINE_WRITABLE = Object.freeze({
  car: ["create", "update", "delete"],
  customer: ["create", "update", "delete"],
  driver: ["create", "update", "delete"],
  booking: ["create", "update"], // cancel/extend/issue/return are special routes -> online only
});

const OBJECT_ID = /^[a-f0-9]{24}$/i;

/** GET responses of these roots may be snapshotted (per business + user). */
const SNAPSHOT_ROOTS = new Set([
  "settings", "dashboard", "reports", "profits", "ledger", "payments", "expenses",
  "inspections", "staff", "drivers", "cars", "customers", "bookings", "reminders",
]);

/** These have dedicated local fallbacks in bookingApi.js. */
const NO_SNAPSHOT = new Set(["bookings/stats", "bookings/availability"]);

export function classifyRequest(args) {
  const request = parseRequest(args);
  const [root, second] = request.segments;
  if (!root) return null;

  const entity = ENTITY_BY_ROOT[root];
  let action = null;
  let id = null;

  if (entity && request.segments.length <= 2) {
    if (!second) {
      action = request.method === "GET" ? "list" : request.method === "POST" ? "create" : null;
    } else if (OBJECT_ID.test(second) || isLocalId(second)) {
      id = second;
      action =
        request.method === "GET" ? "get"
        : request.method === "PATCH" || request.method === "PUT" ? "update"
        : request.method === "DELETE" ? "delete"
        : null;
    }
  }

  const key = request.segments.join("/");
  const snapshotable =
    request.method === "GET" &&
    !NO_SNAPSHOT.has(key) &&
    (key === "auth/me" || (root !== "auth" && SNAPSHOT_ROOTS.has(root)));

  if (!action && !snapshotable) return null;

  return { ...request, entity: action ? entity : null, action, id, key, snapshotable };
}

export function rewriteRequestId(args, from, to) {
  if (typeof args === "string") return args.replace(from, to);
  return { ...args, url: String(args.url || "").replace(from, to) };
}