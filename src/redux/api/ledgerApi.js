/**
 * src/redux/api/ledgerApi.js
 *
 * Customer ledger (statement) with proper online + offline support.
 *
 * Online  → fetch real ledger from backend and cache the response
 * Offline → serve the last successfully cached ledger
 * No cache → clear “unavailable” state (never show fake zeros)
 *
 * Same hooks, same argument shapes, zero page changes.
 */

import { baseApi, clean } from "./baseApi";
import { unwrap, idOf } from "./bookingApi";
import {
  isBrowserOnline,
  isNetworkFailure,
} from "@/offline/offlineAdapter";
import { getMeta, setMeta } from "@/offline/cache";

// ======================================================
// HELPERS
// ======================================================

const withId = (d) =>
  d && typeof d === "object" ? { ...d, id: d.id ?? d._id } : d;

const toList = (res, map = withId) => {
  const body = unwrap(res) || res || {};
  const items = (body.items || []).map((r, i) => map(r, i));
  const p = body.pagination || {};

  return {
    items,
    pagination: p,
    page: body.page ?? p.page ?? 1,
    pageSize: body.pageSize ?? p.limit ?? items.length,
    total: body.total ?? p.total ?? items.length,
    totalPages: body.totalPages ?? p.totalPages ?? 1,
    summary: body.summary,
    _offline: body._offline || false,
  };
};

const num = (v, d = 0) =>
  Number.isFinite(Number(v)) ? Number(v) : d;

const pick = (o, keys, d) => {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k];
  }
  return d;
};

/**
 * Normalize a single ledger entry.
 * Accepts many possible backend field names.
 */
const normEntry = (e = {}, i = 0) => {
  const id = String(e.id ?? e._id ?? i);
  return {
    ...e,
    id,
    key: id,
    date: pick(e, ["date", "entryDate", "paymentDate", "createdAt"], null),
    type: String(
      pick(e, ["type", "entryType", "kind", "transactionType"], "")
    ),
    reference: String(
      pick(e, [
        "reference",
        "referenceNo",
        "number",
        "bookingNumber",
        "paymentNumber",
        "receiptNo",
      ], "")
    ),
    description: String(
      pick(e, ["description", "narration", "details", "notes", "title"], "")
    ),
    bookingId: idOf(e.bookingId),
    debit: num(pick(e, ["debit", "debitAmount", "billed", "charge"], 0)),
    credit: num(pick(e, ["credit", "creditAmount", "received"], 0)),
    balance: pick(e, ["balance", "runningBalance"], null),
  };
};

// ======================================================
// CACHE KEY HELPERS
// ======================================================

/**
 * Build a stable cache key for a ledger query.
 * Includes business, customer and the main query parameters
 * so different date ranges / pages do not overwrite each other.
 */
function buildLedgerCacheKey(businessId, customerId, params = {}) {
  const parts = [
    "ledger",
    String(businessId || "unknown"),
    String(customerId || "unknown"),
    params.page ?? 1,
    params.limit ?? params.pageSize ?? 50,
    params.from || "",
    params.to || "",
  ];
  return parts.join(":");
}

/**
 * Normalize the full ledger response into the shape the page expects.
 */
function normalizeLedgerResponse(raw, customerId) {
  const body = unwrap(raw) || raw || {};
  const rows =
    body.items ??
    body.entries ??
    body.transactions ??
    body.ledger ??
    body.rows ??
    (Array.isArray(body) ? body : []);

  const base = toList({ ...body, items: rows }, normEntry);
  const s = body.summary ?? body.totals ?? {};

  const opening = num(
    pick(
      s,
      ["openingBalance"],
      pick(
        body,
        ["openingBalance"],
        pick(body.customer || {}, ["openingBalance"], 0)
      )
    )
  );

  // Prefer backend-provided running balance.
  // Only rebuild when we are on page 1 and the backend did not supply it.
  let run = opening;
  const items = base.items.map((e) => {
    if (e.balance !== null && e.balance !== undefined) {
      return { ...e, balance: num(e.balance) };
    }
    if (base.page <= 1) {
      run += e.debit - e.credit;
      return { ...e, balance: run };
    }
    return e;
  });

  const totalDebit = num(
    pick(
      s,
      ["totalDebit", "totalBilled", "debit"],
      items.reduce((a, e) => a + e.debit, 0)
    )
  );
  const totalCredit = num(
    pick(
      s,
      ["totalCredit", "totalReceived", "credit"],
      items.reduce((a, e) => a + e.credit, 0)
    )
  );
  const closingBalance = num(
    pick(
      s,
      ["closingBalance", "balance", "currentBalance", "outstanding"],
      opening + totalDebit - totalCredit
    )
  );

  return {
    ...base,
    items,
    customer: body.customer ? withId(body.customer) : { id: customerId },
    summary: {
      openingBalance: opening,
      totalDebit,
      totalCredit,
      closingBalance,
    },
  };
}

/**
 * Clear “unavailable” response when we have never cached this ledger.
 * Deliberately does NOT show zero balances.
 */
function unavailableLedger(customerId) {
  return {
    items: [],
    pagination: {},
    page: 1,
    pageSize: 0,
    total: 0,
    totalPages: 1,
    customer: customerId ? { id: customerId } : null,
    summary: null, // null = “no data available offline”
    _offline: true,
    _unavailable: true,
  };
}

// ======================================================
// LEDGER API
// ======================================================

export const ledgerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * GET /ledger/customers/:customerId
     *
     * Online success  → normalize + cache + return
     * Offline / net   → return last cached version (if any)
     * No cache        → unavailable state (never fake zeros)
     */
    getLedger: builder.query({
      async queryFn({ customerId, ...p }, api, _extraOptions, baseQuery) {
        const state = api.getState();
        const auth = state?.auth || {};
        const user = auth.user || {};
        const businessId =
          auth.businessId ||
          user.businessId ||
          user.business?._id ||
          user.business?.id ||
          null;

        const cacheKey = buildLedgerCacheKey(businessId, customerId, p);

        // --------------------------------------------------
        // 1. ONLINE PATH
        // --------------------------------------------------
        if (isBrowserOnline()) {
          const result = await baseQuery({
            url: `/ledger/customers/${customerId}`,
            method: "GET",
            params: clean({
              page: p.page,
              limit: p.pageSize ?? p.limit,
              from: p.from,
              to: p.to,
            }),
          });

          if (!result.error) {
            const normalized = normalizeLedgerResponse(
              result.data,
              customerId
            );

            // Cache the successful response for offline use
            try {
              await setMeta(cacheKey, {
                ...normalized,
                _cachedAt: new Date().toISOString(),
              });
            } catch {
              // Caching failure must never break the online response
            }

            return { data: normalized };
          }

          // Real backend error (validation, auth, not-found…) → surface it
          if (!isNetworkFailure(result.error)) {
            return { error: result.error };
          }
          // Otherwise fall through to offline cache
        }

        // --------------------------------------------------
        // 2. OFFLINE / NETWORK FAILURE → try cache
        // --------------------------------------------------
        try {
          const cached = await getMeta(cacheKey);

          if (cached && Array.isArray(cached.items)) {
            return {
              data: {
                ...cached,
                _offline: true,
                _fromCache: true,
              },
            };
          }
        } catch {
          // ignore cache read errors
        }

        // --------------------------------------------------
        // 3. NO CACHE AVAILABLE
        // --------------------------------------------------
        return {
          data: unavailableLedger(customerId),
        };
      },

      providesTags: (result, error, { customerId }) => [
        "Ledger",
        { type: "Customers", id: customerId },
        "Payments",
        "Bookings",
      ],
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS (unchanged names)
// ======================================================

export const {
  useGetLedgerQuery,
  useLazyGetLedgerQuery,
} = ledgerApi;