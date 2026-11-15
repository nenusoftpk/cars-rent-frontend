import { baseApi, clean } from "./baseApi";
import { unwrap } from "./bookingApi";

// ======================================================
// HELPERS
// ======================================================

const withId = (d) => (d && typeof d === "object" ? { ...d, id: d.id ?? d._id } : d);

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
    summary: body.summary || {
      total: p.total ?? items.length,
      sensitive: 0,
    },
  };
};

const DOCUMENT_TAGS = [
  "Documents",
  "Customers",
  "Cars",
  "Inspections",
  "Bookings",
  "Dashboard",
  "Reports",
];

// ======================================================
// MAP QUERY PARAMS (frontend → backend)
// ======================================================

export const mapDocumentParams = (p = {}) =>
  clean({
    page: p.page,
    limit: p.pageSize ?? p.limit,
    search: typeof p.search === "string" ? p.search.trim() : p.search,
    type: p.type || undefined,
    ownerType: p.ownerType || undefined,
    from: p.from || undefined,
    to: p.to || undefined,
    sort: p.sort || "uploadedAt:desc",
  });

// ======================================================
// API
// ======================================================

export const documentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // --------------------------------------------------
    // 1. LIST DOCUMENTS
    // GET /documents
    // --------------------------------------------------
    getDocuments: builder.query({
      query: (params = {}) => ({
        url: "/documents",
        method: "GET",
        params: mapDocumentParams(params),
      }),
      transformResponse: (res) => toList(res),
      providesTags: ["Documents"],
    }),

    // --------------------------------------------------
    // 2. UPLOAD DOCUMENT
    // POST /documents
    // Body: FormData → ownerType, ownerId, type, file
    // --------------------------------------------------
    uploadDocument: builder.mutation({
      query: ({ ownerType, ownerId, type, file }) => {
        const formData = new FormData();

        formData.append("ownerType", ownerType);
        formData.append("ownerId", ownerId);
        formData.append("type", type);

        if (file instanceof File) {
          formData.append("file", file, file.name || "document");
        }

        return {
          url: "/documents",
          method: "POST",
          body: formData,
          // Do NOT set Content-Type – browser will set the boundary
        };
      },
      invalidatesTags: DOCUMENT_TAGS,
    }),

    // --------------------------------------------------
    // 3. REPLACE DOCUMENT
    // PATCH /documents/:id
    // :id is a composite ID (e.g. customer:64f...:CNIC Front)
    // --------------------------------------------------
    replaceDocument: builder.mutation({
      query: ({ id, file }) => {
        const formData = new FormData();

        if (file instanceof File) {
          formData.append("file", file, file.name || "document");
        }

        return {
          url: `/documents/${id}`,
          method: "PATCH",
          body: formData,
        };
      },
      invalidatesTags: DOCUMENT_TAGS,
    }),

    // --------------------------------------------------
    // 4. DELETE DOCUMENT
    // DELETE /documents/:id
    // --------------------------------------------------
    deleteDocument: builder.mutation({
      query: (id) => ({
        url: `/documents/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: DOCUMENT_TAGS,
    }),
  }),

  overrideExisting: false,
});

// ======================================================
// HOOKS
// ======================================================

export const {
  useGetDocumentsQuery,
  useLazyGetDocumentsQuery,
  useUploadDocumentMutation,
  useReplaceDocumentMutation,
  useDeleteDocumentMutation,
} = documentApi;