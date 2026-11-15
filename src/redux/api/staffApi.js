// PATH: src/redux/api/staffApi.js   (REPLACE your existing file)
import { baseApi, clean } from './baseApi';
import { unwrap } from './bookingApi';

const STAFF_TAGS = ['Staff', 'Auth', 'Dashboard'];

// Multer field name for the profile photo on POST /employees and PATCH /employees/:id.
// employeeRoutes.js was not uploaded - if your route uses .single('photo') (or similar), change this one word.
const AVATAR_FIELD = 'avatar';

const withId = (d) => (d && typeof d === 'object' ? { ...d, id: d.id ?? d._id } : d);
const toList = (res) => {
  const body = unwrap(res) || {};
  const items = (body.items || []).map(withId);
  const p = body.pagination || {};
  return {
    items,
    pagination: p,
    page: p.page ?? 1,
    pageSize: p.limit ?? items.length,
    total: p.total ?? items.length,
    totalPages: p.totalPages ?? 1,
  };
};

/**
 * GET /employees only reads: page, limit, search, status (active | disabled), dataScope (own | business).
 * It always sorts newest first - there is no sort / role parameter.
 */
export const mapStaffParams = (p = {}) =>
  clean({
    page: p.page,
    limit: p.pageSize ?? p.limit,
    search: typeof p.search === 'string' ? p.search.trim() : p.search,
    status: p.status,
    dataScope: p.dataScope,
  });

/**
 * createEmployeeSchema / updateEmployeeSchema are .unknown(false):
 *   create: name, email, phone, password, permissions, dataScope (+ avatar file)
 *   update: name, phone (+ avatar file)         <- status / permissions / password have their own endpoints
 * JSON when there is no photo, multipart (permissions as a JSON string) when there is one.
 */
function staffBody(b = {}, creating) {
  const json = { name: String(b.name ?? '').trim(), phone: String(b.phone ?? '').trim() };
  if (creating) {
    json.email = String(b.email ?? '').trim();
    json.password = b.password;
    json.permissions = b.permissions ?? [];
    json.dataScope = b.dataScope || 'own';
  }
  const file = b.photo instanceof File ? b.photo : null;
  if (!file) return json;

  const fd = new FormData();
  Object.entries(json).forEach(([k, v]) => fd.append(k, k === 'permissions' ? JSON.stringify(v) : String(v)));
  fd.append(AVATAR_FIELD, file);
  return fd;
}

export const staffApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getStaff: builder.query({
      query: (params = {}) => ({ url: '/employees', method: 'GET', params: mapStaffParams(params) }),
      transformResponse: toList,
      providesTags: ['Staff'],
    }),

    // { allowedPermissions, defaultEmployeePermissions, dataScopes } - drives the permission matrix
    getStaffOptions: builder.query({
      query: () => ({ url: '/employees/permissions', method: 'GET' }),
      transformResponse: (res) => unwrap(res),
      providesTags: ['Staff'],
    }),

    getStaffMember: builder.query({
      query: (id) => ({ url: `/employees/${id}`, method: 'GET' }),
      transformResponse: (res) => withId(unwrap(res)),
      providesTags: (result, error, id) => ['Staff', { type: 'Staff', id }],
    }),

    addStaff: builder.mutation({
      query: (body) => ({ url: '/employees', method: 'POST', body: staffBody(body, true) }),
      invalidatesTags: STAFF_TAGS,
    }),

    updateStaff: builder.mutation({
      query: ({ id, ...body }) => ({ url: `/employees/${id}`, method: 'PATCH', body: staffBody(body, false) }),
      invalidatesTags: STAFF_TAGS,
    }),

    // body: { permissions: string[], dataScope: 'own' | 'business' } - both required by the backend
    updateStaffPermissions: builder.mutation({
      query: ({ id, permissions, dataScope }) => ({ url: `/employees/${id}/permissions`, method: 'PATCH', body: { permissions, dataScope } }),
      invalidatesTags: STAFF_TAGS,
    }),

    // body: { status: 'active' | 'disabled' }  (disabling also logs the employee out everywhere)
    updateStaffStatus: builder.mutation({
      query: ({ id, status }) => ({ url: `/employees/${id}/status`, method: 'PATCH', body: { status } }),
      invalidatesTags: STAFF_TAGS,
    }),

    // body: { newPassword } - min 10 characters
    resetStaffPassword: builder.mutation({
      query: ({ id, newPassword }) => ({ url: `/employees/${id}/reset-password`, method: 'POST', body: { newPassword } }),
      invalidatesTags: ['Staff', 'Auth'],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetStaffQuery,
  useLazyGetStaffQuery,
  useGetStaffOptionsQuery,
  useLazyGetStaffOptionsQuery,
  useGetStaffMemberQuery,
  useLazyGetStaffMemberQuery,
  useAddStaffMutation,
  useUpdateStaffMutation,
  useUpdateStaffPermissionsMutation,
  useUpdateStaffStatusMutation,
  useResetStaffPasswordMutation,
} = staffApi;