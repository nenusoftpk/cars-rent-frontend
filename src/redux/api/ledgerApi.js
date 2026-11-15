// PATH: src/redux/api/ledgerApi.js   (REPLACE your existing file)
import { baseApi, clean } from './baseApi';
import { unwrap, idOf } from './bookingApi';

// list rows -> { items, pagination, page, pageSize, total, totalPages } (same shape paymentApi's flatten() gives DataTable)
const withId = (d) => (d && typeof d === "object" ? { ...d, id: d.id ?? d._id } : d);
const toList = (res, map = withId) => {
  const body = unwrap(res) || {};
  const items = (body.items || []).map((r, i) => map(r, i));
  const p = body.pagination || {};
  return {
    items,
    pagination: p,
    page: p.page ?? 1,
    pageSize: p.limit ?? items.length,
    total: p.total ?? items.length,
    totalPages: p.totalPages ?? 1,
    summary: body.summary,
  };
};
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pick = (o, keys, d) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return d;
};

/**
 * GET /ledger/customers/:customerId
 * I could not see the ledger controller, so this normalizer accepts the usual shapes.
 * If your response uses other key names, add them to the pick([...]) lists below - nothing else needs to change.
 */
const normEntry = (e = {}, i = 0) => {
  const id = String(e.id ?? e._id ?? i);
  return {
    ...e,
    id,
    key: id,
    date: pick(e, ['date', 'entryDate', 'paymentDate', 'createdAt'], null),
    type: String(pick(e, ['type', 'entryType', 'kind', 'transactionType'], '')),
    reference: String(pick(e, ['reference', 'referenceNo', 'number', 'bookingNumber', 'paymentNumber', 'receiptNo'], '')),
    description: String(pick(e, ['description', 'narration', 'details', 'notes', 'title'], '')),
    bookingId: idOf(e.bookingId),
    debit: num(pick(e, ['debit', 'debitAmount', 'billed', 'charge'], 0)),
    credit: num(pick(e, ['credit', 'creditAmount', 'received'], 0)),
    balance: pick(e, ['balance', 'runningBalance'], null),
  };
};

export const ledgerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getLedger: builder.query({
      query: ({ customerId, ...p }) => ({
        url: `/ledger/customers/${customerId}`,
        method: 'GET',
        params: clean({ page: p.page, limit: p.pageSize ?? p.limit, from: p.from, to: p.to }),
      }),
      transformResponse: (res) => {
        const body = unwrap(res) || {};
        const rows = body.items ?? body.entries ?? body.transactions ?? body.ledger ?? body.rows ?? (Array.isArray(body) ? body : []);
        const base = toList({ ...body, items: rows }, normEntry);
        const s = body.summary ?? body.totals ?? {};
        const opening = num(pick(s, ['openingBalance'], pick(body, ['openingBalance'], pick(body.customer || {}, ['openingBalance'], 0))));

        // running balance: use the backend's value, otherwise rebuild it (only possible from page 1)
        let run = opening;
        const items = base.items.map((e) => {
          if (e.balance !== null && e.balance !== undefined) return { ...e, balance: num(e.balance) };
          if (base.page <= 1) {
            run += e.debit - e.credit;
            return { ...e, balance: run };
          }
          return e;
        });

        const totalDebit = num(pick(s, ['totalDebit', 'totalBilled', 'debit'], items.reduce((a, e) => a + e.debit, 0)));
        const totalCredit = num(pick(s, ['totalCredit', 'totalReceived', 'credit'], items.reduce((a, e) => a + e.credit, 0)));
        const closingBalance = num(pick(s, ['closingBalance', 'balance', 'currentBalance', 'outstanding'], opening + totalDebit - totalCredit));

        return {
          ...base,
          items,
          customer: body.customer ? withId(body.customer) : null,
          summary: { openingBalance: opening, totalDebit, totalCredit, closingBalance },
        };
      },
      providesTags: (result, error, { customerId }) => ['Ledger', { type: 'Customers', id: customerId }, 'Payments', 'Bookings'],
    }),
  }),
  overrideExisting: false,
});

export const { useGetLedgerQuery, useLazyGetLedgerQuery } = ledgerApi;