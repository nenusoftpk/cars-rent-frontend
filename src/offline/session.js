/**
 * src/offline/session.js
 *
 * Offline-session policy + tenant/user context.
 *
 * POLICY (explicit):
 *  - Offline access needs a logged-in session whose user was last verified by the
 *    server within OFFLINE_SESSION_DAYS (default 7, env NEXT_PUBLIC_OFFLINE_SESSION_DAYS).
 *  - An EXPIRED JWT is only kept at startup while the browser is offline AND inside that
 *    window. The token is never "renewed" locally: the first request that reaches the
 *    server returns 401 and the existing sessionExpired flow logs the user out.
 *  - Local entity tables (cars/bookings/...) are readable offline by ADMINS only.
 *    Employees only get snapshots of responses the server already returned to them
 *    (scoped by businessId + userId), and cannot queue offline writes.
 *  - Super-admins (no businessId) never use the offline cache.
 */

export const OFFLINE_SESSION_DAYS = Math.max(
  1,
  Number(process.env.NEXT_PUBLIC_OFFLINE_SESSION_DAYS) || 7
);

const DAY = 86400000;
const verifiedKey = (userId) => `rac_verified:${userId}`;

export const asId = (value) => {
  if (value == null) return null;
  if (typeof value === "object") {
    const id = value._id ?? value.id;
    return id == null || id === "" ? null : String(id);
  }
  return value === "" ? null : String(value);
};

/** Single source of truth for "who is making this request". Returns null if not eligible. */
export function resolveContext(state) {
  const auth = state?.auth || {};
  const user = auth.user || {};
  const token = auth.token;
  const businessId = asId(auth.businessId ?? user.businessId ?? user.business);
  const userId = asId(user.id ?? user._id);

  if (!token || !businessId || !userId) return null;

  return {
    token,
    businessId,
    userId,
    role: user.role || null,
    isAdmin: user.role === "admin",
  };
}

let lastMark = 0;

/** Record that the server just answered an authenticated request for this user. */
export function markVerified(userId) {
  if (!userId || typeof window === "undefined") return;
  const t = Date.now();
  if (t - lastMark < 30000) return;
  lastMark = t;
  try {
    localStorage.setItem(verifiedKey(userId), String(t));
  } catch {
    // storage may be disabled
  }
}

export function getVerifiedAt(userId) {
  try {
    return Number(localStorage.getItem(verifiedKey(userId))) || 0;
  } catch {
    return 0;
  }
}

export function isWithinOfflineWindow(userId, fallbackTimestamp = 0) {
  const ts = Math.max(getVerifiedAt(userId), Number(fallbackTimestamp) || 0);
  return ts > 0 && Date.now() - ts <= OFFLINE_SESSION_DAYS * DAY;
}

/** Decode (NOT verify) a JWT's exp, in ms. */
export function jwtExpiryMs(token) {
  try {
    const part = String(token).split(".")[1];
    const json = atob(
      part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=")
    );
    const exp = JSON.parse(json).exp;
    return typeof exp === "number" ? exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Used by provider.jsx at startup for an already-expired token. */
export function canKeepExpiredSession(user) {
  if (typeof navigator === "undefined" || navigator.onLine) return false;
  return isWithinOfflineWindow(asId(user?.id ?? user?._id));
}