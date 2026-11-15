'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Upload,
  Eye,
  Replace,
  Download,
  Trash2,
  Lock,
  FileText,
  ShieldAlert,
  Files,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import PageContainer from '@/components/layout/PageContainer';
import PermissionGuard from '@/components/layout/PermissionGuard';
import StatCard from '@/components/common/StatCard';
import SectionCard from '@/components/common/SectionCard';
import StatusBadge from '@/components/common/StatusBadge';
import SmartImage from '@/components/common/SmartImage';
import FilterPanel from '@/components/filters/FilterPanel';
import SearchInput from '@/components/filters/SearchInput';
import SelectFilter from '@/components/filters/SelectFilter';
import DateRangeFilter from '@/components/filters/DateRangeFilter';
import DataTable from '@/components/tables/DataTable';
import TableActions from '@/components/tables/TableActions';
import AppModal from '@/components/modals/AppModal';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import Form from '@/components/forms/Form';
import FormSelect from '@/components/forms/FormSelect';
import FormRadioGroup from '@/components/forms/FormRadioGroup';
import FormFileUpload from '@/components/forms/FormFileUpload';
import CustomerSelector from '@/components/forms/CustomerSelector';
import CarSelector from '@/components/forms/CarSelector';

import {
  useGetDocumentsQuery,
  useUploadDocumentMutation,
  useReplaceDocumentMutation,
  useDeleteDocumentMutation,
} from '@/redux/api/documentApi'; // ← correct import

import { errorMessage } from '@/redux/api/baseApi';
import { useListParams } from '@/hooks/useListParams';
import { useAuth } from '@/hooks/useAuth';
import { downloadUrl, isImageUrl } from '@/lib/files';
import { fmtDateTime } from '@/lib/dates';

// ======================================================
// CONSTANTS
// ======================================================

const CUSTOMER_TYPES = [
  'Customer Photo',
  'CNIC Front',
  'CNIC Back',
  'Driving Licence',
];

const CAR_TYPES = [
  'Car Photo',
  'Registration Document',
  'Insurance Document',
  'Token Tax Document',
];

const ALL_TYPES = [
  ...CUSTOMER_TYPES,
  ...CAR_TYPES,
  'Handover Photo',
  'Return Photo',
];

const kb = (n) => `${Math.max(1, Math.round((n || 0) / 1024))} KB`;

// ======================================================
// UPLOAD MODAL
// ======================================================

function UploadModal({ open, onClose }) {
  const [uploadDocument, { isLoading }] = useUploadDocumentMutation();
  const form = useForm({
    defaultValues: {
      ownerType: 'customer',
      ownerId: '',
      type: 'CNIC Front',
      file: null,
    },
  });

  const ownerType = form.watch('ownerType');

  const onSubmit = async (values) => {
    if (!values.ownerId) {
      return form.setError('ownerId', {
        message: 'Please select who this document belongs to',
      });
    }

    // FormFileUpload stores the real File object in the field
    const file = values.file instanceof File ? values.file : values.file?.file;

    if (!file) {
      return form.setError('file', { message: 'Please choose a file' });
    }

    try {
      await uploadDocument({
        ownerType: values.ownerType,
        ownerId: values.ownerId,
        type: values.type,
        file,
      }).unwrap();

      toast.success('Document uploaded successfully');
      form.reset();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Upload Document"
      footer={
        <>
          <button type="button" className="btn btn-neutral" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="doc-upload-form"
            className="btn btn-primary"
            disabled={isLoading}
          >
            <Upload size={16} />
            {isLoading ? 'Uploading…' : 'Upload'}
          </button>
        </>
      }
    >
      <Form id="doc-upload-form" form={form} onSubmit={onSubmit} className="space-y-3">
        <FormRadioGroup
          name="ownerType"
          label="Belongs to"
          options={[
            { value: 'customer', label: 'Customer' },
            { value: 'car', label: 'Car' },
          ]}
        />

        {ownerType === 'customer' ? (
          <CustomerSelector
            name="ownerId"
            label="Customer"
            required
            params={{ status: '' }}
          />
        ) : (
          <CarSelector name="ownerId" label="Car" required />
        )}

        <FormSelect
          key={ownerType} // force re-render when ownerType changes
          name="type"
          label="Document Type"
          required
          options={ownerType === 'customer' ? CUSTOMER_TYPES : CAR_TYPES}
          placeholder={null}
        />

        <FormFileUpload
          name="file"
          label="File"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf"
        />

        <p className="text-xs text-muted">
          If this document type already exists for the same customer or car, it
          will be replaced automatically.
        </p>
      </Form>
    </AppModal>
  );
}

// ======================================================
// PREVIEW MODAL
// ======================================================

function PreviewModal({ doc, onClose }) {
  return (
    <AppModal
      open={!!doc}
      onClose={onClose}
      size="lg"
      title={doc?.type || ''}
      subtitle={doc?.ownerName}
      footer={
        <>
          {doc?.url && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => downloadUrl(doc.url, doc.name)}
            >
              <Download size={16} />
              Download
            </button>
          )}
          <button type="button" className="btn btn-neutral" onClick={onClose}>
            Close
          </button>
        </>
      }
    >
      {doc?.url &&
        (isImageUrl(doc.url) ? (
          <SmartImage
            src={doc.url}
            alt={doc.type}
            width={900}
            height={600}
            className="w-full max-h-[65vh] object-contain rounded-xl bg-soft"
          />
        ) : (
          <iframe
            title="Document preview"
            src={doc.url}
            className="w-full h-[60vh] rounded-xl border border-line"
          />
        ))}
    </AppModal>
  );
}

// ======================================================
// MAIN PAGE
// ======================================================

export default function DocumentsPage() {
  const { can } = useAuth();

  const { params, setParams, reset, hasFilters, apiParams } = useListParams({
    sort: 'uploadedAt:desc',
  });

  const { data, isLoading, isFetching, error, refetch } =
    useGetDocumentsQuery(apiParams);

  const [replaceDocument] = useReplaceDocumentMutation();
  const [deleteDocument, { isLoading: isDeleting }] =
    useDeleteDocumentMutation();

  const [showUpload, setShowUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --------------------------------------------------
  // Replace document (opens file picker)
  // --------------------------------------------------
  const handleReplace = (doc) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp,application/pdf';

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        await replaceDocument({
          id: doc.id, // composite ID coming from backend
          file,
        }).unwrap();

        toast.success('Document replaced successfully');
      } catch (err) {
        toast.error(errorMessage(err));
      }
    };

    input.click();
  };

  // --------------------------------------------------
  // Table columns
  // --------------------------------------------------
  const columns = [
    {
      key: 'thumb',
      header: 'Preview',
      render: (d) => (
        <div className="w-16 h-11 rounded-md border border-line bg-soft overflow-hidden grid place-items-center">
          {d.locked ? (
            <Lock size={16} className="text-muted" />
          ) : isImageUrl(d.url) ? (
            <SmartImage
              src={d.url}
              alt=""
              width={64}
              height={44}
              className="size-full object-cover"
            />
          ) : (
            <FileText size={18} className="text-primary" />
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Document',
      sortable: true,
      render: (d) => (
        <span className="flex items-center gap-1.5">
          <b>{d.type}</b>
          {d.sensitive && (
            <ShieldAlert
              size={13}
              className="text-orange-500"
              aria-label="Sensitive"
            />
          )}
        </span>
      ),
    },
    {
      key: 'ownerName',
      header: 'Belongs To',
      sortable: true,
      render: (d) => (
        <span>
          {d.ownerName}
          <span className="block text-xs text-muted capitalize">
            {d.ownerType}
          </span>
        </span>
      ),
    },
    {
      key: 'name',
      header: 'File',
      render: (d) => (
        <span className="text-xs">
          {d.name} · {kb(d.size)}
        </span>
      ),
    },
    {
      key: 'uploadedAt',
      header: 'Uploaded',
      sortable: true,
      render: (d) => (
        <span className="text-xs whitespace-nowrap">
          {fmtDateTime(d.uploadedAt)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Action',
      render: (d) =>
        d.locked ? (
          <StatusBadge tone="neutral">Hidden</StatusBadge>
        ) : (
          <TableActions
            actions={[
              {
                label: 'Preview',
                icon: Eye,
                onClick: () => setPreviewDoc(d),
              },
              {
                label: 'Download',
                icon: Download,
                onClick: () => downloadUrl(d.url, d.name),
              },
              {
                label: 'Replace',
                icon: Replace,
                onClick: () => handleReplace(d),
                hidden: !can('documents:edit') && !can('documents:create'),
              },
              {
                label: 'Delete',
                icon: Trash2,
                danger: true,
                onClick: () => setDeleteTarget(d),
                hidden: !can('documents:delete'),
              },
            ]}
          />
        ),
    },
  ];

  // --------------------------------------------------
  // Render
  // --------------------------------------------------
  return (
    <PermissionGuard perm="documents.view" page>
      <PageHeader
        title="Documents"
        subtitle="Customer papers, car papers and handover / return photos in one place."
        actions={
          <PermissionGuard perm="documents.create">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowUpload(true)}
            >
              <Upload size={18} />
              Upload Document
            </button>
          </PermissionGuard>
        }
      />

      <PageContainer>
        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Files}
            tone="blue"
            label="All Documents"
            value={data?.summary?.total}
            loading={isLoading}
          />
          <StatCard
            icon={ShieldAlert}
            tone="orange"
            label="Sensitive Documents"
            value={data?.summary?.sensitive}
            loading={isLoading}
            hint={
              can('sensitive:view')
                ? 'CNIC & licence'
                : 'Hidden – needs permission'
            }
          />
        </div>

        {/* Filters */}
        <FilterPanel onReset={reset} cols="sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="label">Search</label>
            <SearchInput
              value={params.search || ''}
              onChange={(v) => setParams({ search: v })}
              placeholder="Customer, car or document name…"
            />
          </div>

          <SelectFilter
            label="Document Type"
            value={params.type || ''}
            onChange={(v) => setParams({ type: v })}
            options={ALL_TYPES}
            allLabel="All Types"
          />

          <SelectFilter
            label="Belongs To"
            value={params.ownerType || ''}
            onChange={(v) => setParams({ ownerType: v })}
            options={[
              { value: 'customer', label: 'Customers' },
              { value: 'car', label: 'Cars' },
              { value: 'booking', label: 'Bookings (photos)' },
            ]}
            allLabel="All"
          />

          <DateRangeFilter
            from={params.from || ''}
            to={params.to || ''}
            onChange={(p) => setParams(p)}
            fromLabel="Uploaded From"
            toLabel="Uploaded To"
          />
        </FilterPanel>

        {/* Table */}
        <SectionCard title="Document List">
          <DataTable
            columns={columns}
            data={data}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
            sort={params.sort}
            onSort={(v) => setParams({ sort: v })}
            onPage={(p) => setParams({ page: p }, { keepPage: true })}
            onPageSize={(n) => setParams({ pageSize: n })}
            hasFilters={hasFilters}
            onReset={reset}
            noun="documents"
            emptyTitle="No documents yet"
            emptyMessage="Upload a customer or car document."
          />
        </SectionCard>
      </PageContainer>

      {/* Modals */}
      <UploadModal open={showUpload} onClose={() => setShowUpload(false)} />
      <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />

      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title="Delete document?"
        message={`${deleteTarget?.type} of ${deleteTarget?.ownerName} will be permanently deleted.`}
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={async () => {
          try {
            await deleteDocument(deleteTarget.id).unwrap();
            toast.success('Document deleted');
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </PermissionGuard>
  );
}