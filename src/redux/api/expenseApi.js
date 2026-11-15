// PATH: src/redux/api/expenseApi.js   (REPLACE your existing file)
import { baseApi, clean } from './baseApi';
import { unwrap } from './bookingApi';

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

const EXPENSE_TAGS = ['Expenses', 'Reports', 'Dashboard', 'Cars', 'Drivers', 'Bookings', 'Payments', 'Profits', 'Ledger', 'Reminders'];

/**
 * ONE place that decides which query-string names the backend gets.
 * Names follow the Expense model: category, paymentMethod, carId, driverId, bookingId, from/to (expenseDate).
 * If your expense controller reads different names, change them here only.
 */
export const mapExpenseParams = (p = {}) =>
  clean({
    page: p.page,
    limit: p.pageSize ?? p.limit,
    search: typeof p.search === 'string' ? p.search.trim() : p.search,
    from: p.from,
    to: p.to,
    carId: p.carId,
    driverId: p.driverId,
    bookingId: p.bookingId,
    category: p.category,
    paymentMethod: p.paymentMethod,
    sort: p.sort, // e.g. expenseDate:desc | amount:desc
  });

export const expenseApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenses: builder.query({
      query: (params = {}) => ({ url: '/expenses', method: 'GET', params: mapExpenseParams(params) }),
      transformResponse: (res) => toList(res, withId),
      providesTags: ['Expenses'],
    }),

    getExpenseStats: builder.query({
      query: (params = {}) => ({
        url: '/expenses/stats',
        method: 'GET',
        params: clean({ from: params.from, to: params.to, carId: params.carId }),
      }),
      transformResponse: (res) => unwrap(res),
      providesTags: ['Expenses', 'Dashboard'],
    }),

    getExpense: builder.query({
      query: (id) => ({ url: `/expenses/${id}`, method: 'GET' }),
      transformResponse: (res) => {
        const b = unwrap(res);
        return withId(b?.expense ?? b);
      },
      providesTags: (result, error, id) => ['Expenses', { type: 'Expenses', id }],
    }),

    getDriverBookingBalance: builder.query({
      query: (bookingId) => ({ url: `/expenses/driver-balance/${bookingId}`, method: 'GET' }),
      transformResponse: (res) => unwrap(res),
      providesTags: ['Expenses', 'Drivers', 'Bookings'],
    }),

    // JSON body. createExpenseSchema / updateExpenseSchema are .unknown(false):
    // only send fields that exist in expenseValidation.js (the modal builds the exact payload).
    addExpense: builder.mutation({
      query: (body) => ({ url: '/expenses', method: 'POST', body }),
      invalidatesTags: EXPENSE_TAGS,
    }),

    updateExpense: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/expenses/${id}`, method: 'PATCH', body }),
      invalidatesTags: EXPENSE_TAGS,
    }),

    deleteExpense: builder.mutation({
      query: (id) => ({ url: `/expenses/${id}`, method: 'DELETE' }),
      invalidatesTags: EXPENSE_TAGS,
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetExpensesQuery,
  useLazyGetExpensesQuery,
  useGetExpenseStatsQuery,
  useLazyGetExpenseStatsQuery,
  useGetExpenseQuery,
  useLazyGetExpenseQuery,
  useGetDriverBookingBalanceQuery,
  useLazyGetDriverBookingBalanceQuery,
  useAddExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
} = expenseApi;