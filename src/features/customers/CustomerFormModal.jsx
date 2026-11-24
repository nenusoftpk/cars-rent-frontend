'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save, Users, Fingerprint, Wifi, WifiOff, RefreshCw } from 'lucide-react';

import AppModal from '@/components/modals/AppModal';
import ConfirmDialog from '@/components/modals/ConfirmDialog';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormSelect from '@/components/forms/FormSelect';
import PhoneInput from '@/components/forms/PhoneInput';
import CNICInput from '@/components/forms/CNICInput';
import FormImageUpload from '@/components/forms/FormImageUpload';

import { customerSchema } from '@/validations';
import { CITIES, CUSTOMER_TYPES } from '@/constants';
import {
  useAddCustomerMutation,
  useUpdateCustomerMutation,
  useGetCustomerQuery,
} from '@/redux/api/customerApi';
import { errorMessage } from '@/redux/api/baseApi';
import { isBrowserOnline } from '@/offline/offlineAdapter';
import { useAuth } from '@/hooks/useAuth';
import { captureSecuGenThumb } from '@/lib/secugenCapture';

// ======================================================
// GUARANTOR CONSTANTS
// Form field names are IDENTICAL to the API / backend names:
//   guarantor1Enabled, guarantor1Name, guarantor1Mobile,
//   guarantor1Photo, guarantor1CnicFront, guarantor1CnicBack
//   (and the same six for guarantor2)
// ======================================================

const GUARANTOR_NUMBERS = [1, 2];

const GUARANTOR_IMAGES = [
  { suffix: 'Photo', label: 'Guarantor Photo', what: 'photo' },
  { suffix: 'CnicFront', label: 'CNIC Front', what: 'CNIC front image' },
  { suffix: 'CnicBack', label: 'CNIC Back', what: 'CNIC back image' },
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_MB = 5;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

// Same rule as the Mongoose model (prefix 0 / 92 / +92 / 0092 + 3XXXXXXXXX)
const PK_MOBILE_REGEX = /^(?:\+92|0092|92|0)3\d{9}$/;

const gKey = (n, part) => `guarantor${n}${part}`;

const guarantorFieldNames = (n) => [
  gKey(n, 'Enabled'),
  gKey(n, 'Name'),
  gKey(n, 'Mobile'),
  ...GUARANTOR_IMAGES.map((img) => gKey(n, img.suffix)),
];

const ALL_GUARANTOR_FIELDS = GUARANTOR_NUMBERS.flatMap(guarantorFieldNames);

const emptyGuarantors = () =>
  Object.fromEntries(
    GUARANTOR_NUMBERS.flatMap((n) => [
      [gKey(n, 'Enabled'), false],
      [gKey(n, 'Name'), ''],
      [gKey(n, 'Mobile'), ''],
      ...GUARANTOR_IMAGES.map((img) => [gKey(n, img.suffix), null]),
    ])
  );

const cleanMobile = (value) => String(value || '').replace(/[\s-]/g, '');

const isNewImage = (value) =>
  (typeof File !== 'undefined' && value instanceof File) ||
  (typeof value === 'string' && value.startsWith('data:image/'));

// Returns an error message, or '' when the image is fine.
// Existing uploaded image URLs are valid (editing a saved guarantor).
function imageProblem(value, text) {
  if (!value) return `${text} is required.`;

  if (typeof File !== 'undefined' && value instanceof File) {
    if (!ALLOWED_IMAGE_TYPES.includes(value.type)) {
      return `${text} must be a JPG, PNG or WebP image.`;
    }
    if (value.size > MAX_IMAGE_BYTES) {
      return `${text} must be smaller than ${MAX_IMAGE_MB} MB.`;
    }
    return '';
  }

  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) {
      const mime = value.slice(5, value.indexOf(';'));
      if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
        return `${text} must be a JPG, PNG or WebP image.`;
      }
      if (value.length * 0.75 > MAX_IMAGE_BYTES) {
        return `${text} must be smaller than ${MAX_IMAGE_MB} MB.`;
      }
      return '';
    }
    return value.trim() ? '' : `${text} is required.`; // existing URL
  }

  return `${text} is not a valid image.`;
}

export const formatMobile = (value = '') => {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 4) return digits;

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
};

// Guarantor rules (only for guarantors that are ticked):
// all five fields required. Unticked guarantors are never checked.
function validateGuarantors(values) {
  const errors = {};
  const add = (name, message) => {
    errors[name] = { type: 'custom', message };
  };

  for (const n of GUARANTOR_NUMBERS) {
    if (!values[gKey(n, 'Enabled')]) continue;

    const name = String(values[gKey(n, 'Name')] || '').trim();
    if (name.length < 2) {
      add(gKey(n, 'Name'), 'Full name is required (at least 2 characters).');
    } else if (name.length > 120) {
      add(gKey(n, 'Name'), 'Name cannot exceed 120 characters.');
    }

    const mobile = cleanMobile(values[gKey(n, 'Mobile')]);
    if (!mobile) {
      add(gKey(n, 'Mobile'), 'Mobile number is required.');
    } else if (!PK_MOBILE_REGEX.test(mobile)) {
      add(gKey(n, 'Mobile'), 'Enter a valid mobile number, e.g. 03001234567.');
    }

    for (const img of GUARANTOR_IMAGES) {
      const key = gKey(n, img.suffix);
      const problem = imageProblem(values[key], `Guarantor ${n} ${img.what}`);
      if (problem) add(key, problem);
    }
  }

  return errors;
}

// Existing customer rules (zod) + guarantor rules, combined.
// The existing customerSchema is NOT modified.
function makeResolver(locked) {
  const base = zodResolver(
    locked ? customerSchema.omit({ cnic: true }) : customerSchema
  );

  return async (values, context, options) => {
    const result = await base(values, context, options);
    const baseErrors = result.errors || {};

    // Locked users cannot see or change guarantor documents
    const guarantorErrors = locked ? {} : validateGuarantors(values);
    const allErrors = { ...baseErrors, ...guarantorErrors };

    if (Object.keys(allErrors).length) {
      return { values: {}, errors: allErrors };
    }

    // zod strips unknown keys, so carry the guarantor values across
    const extra = Object.fromEntries(
      ALL_GUARANTOR_FIELDS.map((key) => [key, values[key]])
    );
    return { ...result, values: { ...result.values, ...extra } };
  };
}

// ======================================================
// FORM DEFAULTS
// ======================================================

const EMPTY = {
  name: '',
  mobile: '',
  address: '',
  city: 'Lahore',
  type: '',
  cnic: '',
  licenseNo: '',
  photo: null, // File | string (url) | null
  cnicFront: null,
  cnicBack: null,
  licenseImage: null,
  status: 'Active',
  ...emptyGuarantors(),
};

// ======================================================
// ONE GUARANTOR BLOCK (checkbox + fields + fingerprint)
// ======================================================

function GuarantorSection({
  n,
  enabled,
  onToggle,
  errors,
  thumbState,
  onThumbScan,
  onThumbClear,
  onThumbConsent,
  scanning,
  scannerReady,
  locked,
}) {
  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition-colors ${
        enabled ? 'border-primary/40 bg-primary/[0.03]' : 'border-line bg-soft'
      }`}
    >
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          className="size-4 accent-primary cursor-pointer"
          checked={enabled}
          onChange={(e) => onToggle(n, e.target.checked)}
        />
        <span className="text-sm font-semibold">
          Add Guarantor {n} (Optional)
        </span>
      </label>

      {enabled && (
        <div className="mt-4 space-y-4 anim-fade">
          <div className="grid sm:grid-cols-2 gap-3">
            <FormInput
              name={gKey(n, 'Name')}
              label="Full Name"
              required
              placeholder="Guarantor full name"
            />
            <PhoneInput
              name={gKey(n, 'Mobile')}
              label="Mobile Number"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {GUARANTOR_IMAGES.map((img) => {
              const name = gKey(n, img.suffix);
              const message = errors[name]?.message;

              return (
                <div
                  key={name}
                  className={message ? 'rounded-xl ring-2 ring-danger/60 p-1' : ''}
                >
                  <FormImageUpload
                    name={name}
                    label={`${img.label} *`}
                    width="w-full"
                    height="h-28"
                  />
                  {message && (
                    <p className="field-error px-1 pb-1">{message}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Guarantor fingerprint scan */}
          <GuarantorThumbSection
            n={n}
            previewUrl={thumbState?.preview}
            consent={thumbState?.consent}
            onConsentChange={(v) => onThumbConsent(n, v)}
            onScan={() => onThumbScan(n)}
            onClear={() => onThumbClear(n)}
            scanning={scanning}
            scannerReady={scannerReady}
            hasExisting={thumbState?.hasExisting}
            locked={locked}
          />
        </div>
      )}
    </div>
  );
}

// ======================================================
// GUARANTOR THUMB SECTION (per guarantor)
// ======================================================

function GuarantorThumbSection({
  n,
  previewUrl,
  consent,
  onConsentChange,
  onScan,
  onClear,
  scanning,
  scannerReady,
  hasExisting,
  locked,
}) {
  if (locked) {
    return (
      <div className="rounded-xl border border-line bg-soft px-4 py-3 text-sm text-muted">
        Guarantor fingerprint data is hidden – you need permission to view or
        change it.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/[0.02] p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Fingerprint size={16} className="text-primary" />
          <h4 className="text-xs font-extrabold">
            Guarantor {n} Thumb Fingerprint (Optional)
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-medium">
          {scannerReady === null ? (
            <span className="text-muted">Checking…</span>
          ) : scannerReady ? (
            <span className="text-success flex items-center gap-1">
              <Wifi size={11} /> Ready
            </span>
          ) : (
            <span className="text-warning flex items-center gap-1">
              <WifiOff size={11} /> Not detected
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <div className="shrink-0 w-20 h-24 rounded-lg border border-line bg-white overflow-hidden grid place-items-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt={`Guarantor ${n} thumb`}
              className="size-full object-contain"
            />
          ) : (
            <div className="text-center px-1">
              <Fingerprint size={20} className="mx-auto text-muted/50 mb-0.5" />
              <p className="text-[9px] text-muted leading-tight">
                {hasExisting ? 'Saved' : 'No scan'}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-2 min-w-0">
          <p className="text-[11px] text-muted leading-relaxed">
            Optional. Place the guarantor&apos;s right thumb on the SecuGen
            scanner, then press Scan. Requires internet.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onScan}
              disabled={scanning || !isBrowserOnline()}
            >
              {scanning ? (
                <>
                  <RefreshCw size={12} className="animate-spin" /> Scanning…
                </>
              ) : (
                <>
                  <Fingerprint size={12} />{' '}
                  {previewUrl || hasExisting ? 'Rescan' : 'Scan Thumb'}
                </>
              )}
            </button>

            {(previewUrl || hasExisting) && (
              <button
                type="button"
                className="btn btn-neutral btn-sm"
                onClick={onClear}
                disabled={scanning}
              >
                Clear
              </button>
            )}
          </div>

          {!isBrowserOnline() && (
            <p className="text-[11px] text-danger">
              Fingerprint capture requires an internet connection.
            </p>
          )}

          {(previewUrl || hasExisting) && (
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-3.5 mt-0.5 accent-primary cursor-pointer shrink-0"
                checked={consent}
                onChange={(e) => onConsentChange(e.target.checked)}
              />
              <span className="text-[11px] leading-snug">
                Guarantor has given consent to store this fingerprint image
                securely.
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================================================
// SCAN THUMB SECTION (customer)
// ======================================================

function ScanThumbSection({
  previewUrl,
  consent,
  onConsentChange,
  onScan,
  onClear,
  scanning,
  scannerReady,
  hasExisting,
  locked,
}) {
  if (locked) {
    return (
      <div className="rounded-xl border border-line bg-soft px-4 py-3 text-sm text-muted">
        Fingerprint data is hidden – you need permission to view or change it.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Fingerprint size={18} className="text-primary" />
          <h3 className="text-sm font-extrabold">Thumb Fingerprint</h3>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {scannerReady === null ? (
            <span className="text-muted">Checking scanner…</span>
          ) : scannerReady ? (
            <span className="text-success flex items-center gap-1">
              <Wifi size={13} /> Scanner ready
            </span>
          ) : (
            <span className="text-warning flex items-center gap-1">
              <WifiOff size={13} /> Scanner not detected
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start">
        {/* Preview */}
        <div className="shrink-0 w-28 h-36 rounded-xl border border-line bg-white overflow-hidden grid place-items-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Thumb fingerprint"
              className="size-full object-contain"
            />
          ) : (
            <div className="text-center px-2">
              <Fingerprint size={28} className="mx-auto text-muted/50 mb-1" />
              <p className="text-[10px] text-muted leading-tight">
                {hasExisting ? 'Saved fingerprint' : 'No scan yet'}
              </p>
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <p className="text-xs text-muted leading-relaxed">
            Place the customer&apos;s right thumb firmly on the SecuGen Hamster
            Pro 20 scanner, then press Scan. The image is encrypted on the
            server and never stored offline.
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onScan}
              disabled={scanning || !isBrowserOnline()}
            >
              {scanning ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Scanning…
                </>
              ) : (
                <>
                  <Fingerprint size={14} />{' '}
                  {previewUrl || hasExisting ? 'Rescan Thumb' : 'Scan Thumb'}
                </>
              )}
            </button>

            {(previewUrl || hasExisting) && (
              <button
                type="button"
                className="btn btn-neutral btn-sm"
                onClick={onClear}
                disabled={scanning}
              >
                Clear
              </button>
            )}
          </div>

          {!isBrowserOnline() && (
            <p className="text-xs text-danger">
              Fingerprint capture requires an internet connection.
            </p>
          )}

          {/* Consent – required by backend when a new image is uploaded */}
          {(previewUrl || hasExisting) && (
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-4 mt-0.5 accent-primary cursor-pointer shrink-0"
                checked={consent}
                onChange={(e) => onConsentChange(e.target.checked)}
              />
              <span className="text-xs leading-snug">
                Customer has given consent to store this fingerprint image
                securely for identification purposes.
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================================================
// MAIN MODAL
// ======================================================

export default function CustomerFormModal({ open, customer, onClose, onSaved }) {
  const { can } = useAuth();
  const sensitive = can('sensitive:view') || can('customers.documents.view');
  const editing = !!customer?.id;
  const locked = editing && !sensitive;

  const [add, { isLoading: adding }] = useAddCustomerMutation();
  const [update, { isLoading: saving }] = useUpdateCustomerMutation();
  const [removing, setRemoving] = useState(null); // 1 | 2 | null

  // Customer fingerprint local state (never persisted offline)
  const [thumbFile, setThumbFile] = useState(null); // File | null
  const [thumbPreview, setThumbPreview] = useState(null); // data URL | null
  const [thumbConsent, setThumbConsent] = useState(false);
  const [hasExistingThumb, setHasExistingThumb] = useState(false);

  // Guarantor fingerprint local state
  const [gThumb, setGThumb] = useState({
    1: {
      file: null,
      preview: null,
      consent: false,
      hasExisting: false,
    },
    2: {
      file: null,
      preview: null,
      consent: false,
      hasExisting: false,
    },
  });

  const [scanning, setScanning] = useState(false); // which target is scanning: null | 'customer' | 1 | 2
  const [scannerReady, setScannerReady] = useState(null); // null | true | false

  // The customers list does not include guarantor documents, so when
  // editing we load the full customer record (same call the drawer uses).
  const { data: fullData, isError: fullFailed } = useGetCustomerQuery(
    customer?.id,
    { skip: !open || !editing }
  );
  const full = fullData && fullData.id === customer?.id ? fullData : null;
  const source = full || customer || null;
  const ready = !editing || !!full || fullFailed;

  const resolver = useMemo(() => makeResolver(locked), [locked]);

  const form = useForm({
    resolver,
    mode: 'onChange', // keeps `isValid` live so the save button reacts
    defaultValues: EMPTY,
  });

  const { errors, isValid } = form.formState;

  // Reset form + fingerprint state when modal opens / customer changes
  useEffect(() => {
    if (!open || !ready) return;

    const guarantorValues = {};
    for (const n of GUARANTOR_NUMBERS) {
      const g = source?.[`guarantor${n}`] || {};
      guarantorValues[gKey(n, 'Enabled')] = !!g.enabled;
      guarantorValues[gKey(n, 'Name')] = g.name || '';
      guarantorValues[gKey(n, 'Mobile')] = g.mobile || '';
      guarantorValues[gKey(n, 'Photo')] = g.photo || null;
      guarantorValues[gKey(n, 'CnicFront')] = g.cnicFront || null;
      guarantorValues[gKey(n, 'CnicBack')] = g.cnicBack || null;
    }

    form.reset({
      ...EMPTY,
      ...(source || {}),
      // Keep existing image URLs so the preview still shows
      photo: source?.photo || null,
      cnicFront: source?.cnicFront || null,
      cnicBack: source?.cnicBack || null,
      licenseImage: source?.licenseImage || null,
      type: source?.type || '',
      status: source?.status || 'Active',
      mobile: source?.mobile || source?.phone || '',
      licenseNo: source?.licenseNo || source?.licenseNumber || '',
      ...guarantorValues,
    });

    // Customer fingerprint state
    const existing = Boolean(
      source?.hasFingerprint || source?.biometric?.available
    );
    setHasExistingThumb(existing);
    setThumbFile(null);
    setThumbPreview(source?.biometric?.thumbImage || null);
    setThumbConsent(false);

    // Guarantor fingerprint state
    const nextGThumb = {};
    for (const n of GUARANTOR_NUMBERS) {
      const g = source?.[`guarantor${n}`] || {};
      const gExisting = Boolean(g.hasFingerprint || g.biometric?.available);
      nextGThumb[n] = {
        file: null,
        preview: g.biometric?.thumbImage || null,
        consent: false,
        hasExisting: gExisting,
      };
    }
    setGThumb(nextGThumb);
  }, [open, customer?.id, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightweight scanner presence check when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { checkSecuGenAvailable } = await import('@/lib/secugenCapture');
        const ok = await checkSecuGenAvailable();
        if (!cancelled) setScannerReady(ok);
      } catch {
        if (!cancelled) setScannerReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const busy = adding || saving;

  // ---------- customer fingerprint handlers ----------

  const handleScan = async () => {
    if (!isBrowserOnline()) {
      toast.error('Fingerprint capture requires an internet connection.');
      return;
    }
    setScanning('customer');
    try {
      const result = await captureSecuGenThumb();
      setThumbFile(result.file);
      setThumbPreview(result.dataUrl);
      setThumbConsent(false); // force user to re-confirm consent for the new scan
      toast.success('Thumb scanned successfully');
    } catch (err) {
      toast.error(
        err?.message || 'Could not capture fingerprint. Check the scanner.'
      );
    } finally {
      setScanning(false);
    }
  };

  const handleClearThumb = () => {
    setThumbFile(null);
    setThumbPreview(null);
    setHasExistingThumb(false);
    setThumbConsent(false);
  };

  // ---------- guarantor fingerprint handlers ----------

  const handleGScan = async (n) => {
    if (!isBrowserOnline()) {
      toast.error('Fingerprint capture requires an internet connection.');
      return;
    }
    setScanning(n);
    try {
      const result = await captureSecuGenThumb();
      setGThumb((prev) => ({
        ...prev,
        [n]: {
          ...prev[n],
          file: result.file,
          preview: result.dataUrl,
          consent: false,
        },
      }));
      toast.success(`Guarantor ${n} thumb scanned successfully`);
    } catch (err) {
      toast.error(
        err?.message || 'Could not capture fingerprint. Check the scanner.'
      );
    } finally {
      setScanning(false);
    }
  };

  const handleGClear = (n) => {
    setGThumb((prev) => ({
      ...prev,
      [n]: {
        file: null,
        preview: null,
        consent: false,
        hasExisting: false,
      },
    }));
  };

  const handleGConsent = (n, checked) => {
    setGThumb((prev) => ({
      ...prev,
      [n]: { ...prev[n], consent: checked },
    }));
  };

  // ---------- guarantor helpers ----------

  const savedGuarantor = (n) => !!source?.[`guarantor${n}`]?.enabled;

  const applyToggle = (n, checked) => {
    form.setValue(gKey(n, 'Enabled'), checked, { shouldDirty: true });

    if (!checked) {
      // Never keep (or submit) data of an unticked guarantor
      form.setValue(gKey(n, 'Name'), '', { shouldDirty: true });
      form.setValue(gKey(n, 'Mobile'), '', { shouldDirty: true });
      GUARANTOR_IMAGES.forEach((img) =>
        form.setValue(gKey(n, img.suffix), null, { shouldDirty: true })
      );
      // Clear guarantor fingerprint too
      handleGClear(n);
    }

    // Re-check right away so red boxes / save button update
    form.trigger(guarantorFieldNames(n));
  };

  const onToggle = (n, checked) => {
    // Removing a SAVED guarantor deletes its stored documents → confirm first
    if (!checked && savedGuarantor(n)) {
      setRemoving(n);
      return;
    }
    applyToggle(n, checked);
  };

  const confirmRemove = () => {
    applyToggle(removing, false);
    setRemoving(null);
  };

  // ---------- submit ----------

  const onSubmit = async (values) => {
    try {
      // New customer fingerprint requires explicit consent
      if (thumbFile && !thumbConsent) {
        toast.error(
          'Please confirm customer consent before saving the fingerprint.'
        );
        return;
      }

      // New guarantor fingerprints require consent
      for (const n of GUARANTOR_NUMBERS) {
        if (gThumb[n]?.file && !gThumb[n]?.consent) {
          toast.error(
            `Please confirm Guarantor ${n} consent before saving the fingerprint.`
          );
          return;
        }
      }

      const payload = {
        ...values,
        mobile: cleanMobile(values.mobile),
        status: String(values.status || 'Active').toLowerCase(),
      };

      // Attach customer fingerprint only when a NEW scan was performed
      if (thumbFile) {
        payload.thumbImage = thumbFile;
        payload.biometricConsent = 'true';
      }

      let touchesGuarantors = false;
      let touchesGBiometric = false;

      for (const n of GUARANTOR_NUMBERS) {
        const enabled = !locked && !!values[gKey(n, 'Enabled')];
        const wasSaved = !locked && savedGuarantor(n);
        const saved = source?.[`guarantor${n}`] || {};

        const name = String(values[gKey(n, 'Name')] || '').trim();
        const mobile = cleanMobile(values[gKey(n, 'Mobile')]);

        // Start clean: disabled guarantor data is never submitted
        guarantorFieldNames(n).forEach((key) => delete payload[key]);

        if (enabled) {
          const hasNewImage = GUARANTOR_IMAGES.some((img) =>
            isNewImage(values[gKey(n, img.suffix)])
          );
          const hasNewThumb = Boolean(gThumb[n]?.file);
          const changed =
            !wasSaved ||
            name !== (saved.name || '') ||
            mobile !== (saved.mobile || '') ||
            hasNewImage ||
            hasNewThumb;

          // Unchanged saved guarantor → send nothing, backend keeps it
          if (!changed) continue;

          touchesGuarantors = true;
          payload[gKey(n, 'Enabled')] = true;
          payload[gKey(n, 'Name')] = name;
          payload[gKey(n, 'Mobile')] = mobile;
          GUARANTOR_IMAGES.forEach((img) => {
            payload[gKey(n, img.suffix)] = values[gKey(n, img.suffix)];
          });

          // Guarantor fingerprint (new scan only)
          if (hasNewThumb) {
            touchesGBiometric = true;
            payload[gKey(n, 'ThumbImage')] = gThumb[n].file;
            payload[gKey(n, 'BiometricConsent')] = 'true';
          }
        } else if (wasSaved) {
          // Ticked off by the user (and confirmed) → backend deletes it
          touchesGuarantors = true;
          payload[gKey(n, 'Enabled')] = false;
        }
      }

      // Sensitive documents must never be queued in offline storage
      if (
        (touchesGuarantors || touchesGBiometric || thumbFile) &&
        !isBrowserOnline()
      ) {
        toast.error(
          'Sensitive documents and fingerprints cannot be saved offline. Please reconnect and try again.'
        );
        return;
      }

      const saved = editing
        ? await update({ id: customer.id, ...payload }).unwrap()
        : await add(payload).unwrap();

      toast.success(
        editing
          ? 'Customer changes saved successfully'
          : 'Customer saved successfully'
      );

      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const canSave = isValid && ready && !busy;

  return (
    <>
      <AppModal
        open={open}
        onClose={onClose}
        size="lg"
        title={editing ? 'Edit Customer' : 'Add Customer'}
        subtitle="Fields marked * are required."
        footer={
          <>
            {!canSave && !busy && (
              <span className="mr-auto text-xs text-muted self-center">
                {ready
                  ? 'Fill all required fields (*) to enable saving.'
                  : 'Loading customer details…'}
              </span>
            )}

            <button
              type="button"
              className="btn btn-neutral"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              form="customer-form"
              type="submit"
              disabled={!canSave}
            >
              <Save size={16} />
              {busy ? 'Saving…' : editing ? 'Save Changes' : 'Save Customer'}
            </button>
          </>
        }
      >
        <Form
          id="customer-form"
          form={form}
          onSubmit={onSubmit}
          className="space-y-5"
        >
          <div className="flex flex-wrap gap-5">
            <FormImageUpload
              name="photo"
              label="Customer Photo"
              round
              width="w-28"
              height="h-28"
              hint="Face clearly visible"
            />

            <div className="flex-1 min-w-[260px] grid sm:grid-cols-2 gap-3 content-start">
              <FormInput
                name="name"
                label="Full Name"
                required
                placeholder="Ahmed Raza"
                className="sm:col-span-2"
              />
              <PhoneInput name="mobile" required />
              <FormSelect
                name="city"
                label="City"
                options={CITIES}
                placeholder="Select city"
              />
            </div>
          </div>

          <FormInput
            name="address"
            label="Home Address"
            required
            placeholder="House 12, Street 4, DHA Phase 5"
          />

          <div className="grid sm:grid-cols-3 gap-3">
            {locked ? (
              <div>
                <label className="label">CNIC Number</label>
                <input
                  className="input"
                  disabled
                  value={customer?.cnic || ''}
                  readOnly
                />
                <p className="text-xs text-muted mt-1">
                  Hidden – you need permission to change it.
                </p>
              </div>
            ) : (
              <CNICInput name="cnic" required />
            )}

            <FormInput
              name="licenseNo"
              label="Driving Licence Number"
              placeholder="LHR-2019-123456"
              disabled={locked}
            />

            <FormSelect
              name="type"
              label="Customer Type"
              options={CUSTOMER_TYPES}
              placeholder="Normal"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <FormImageUpload
              name="cnicFront"
              label="CNIC Front"
              width="w-full"
              height="h-28"
              locked={locked}
            />
            <FormImageUpload
              name="cnicBack"
              label="CNIC Back"
              width="w-full"
              height="h-28"
              locked={locked}
            />
            <FormImageUpload
              name="licenseImage"
              label="Driving Licence Photo"
              width="w-full"
              height="h-28"
              locked={locked}
            />
          </div>

          {/* ---------------- THUMB FINGERPRINT (customer) ---------------- */}
          <ScanThumbSection
            previewUrl={thumbPreview}
            consent={thumbConsent}
            onConsentChange={setThumbConsent}
            onScan={handleScan}
            onClear={handleClearThumb}
            scanning={scanning === 'customer'}
            scannerReady={scannerReady}
            hasExisting={hasExistingThumb}
            locked={locked}
          />

          {/* ---------------- GUARANTORS ---------------- */}
          <div className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-primary" />
              <h3 className="text-sm font-extrabold">Guarantors (Optional)</h3>
            </div>

            {locked ? (
              <p className="text-xs text-muted rounded-lg bg-soft border border-line px-3 py-2">
                Guarantor documents are hidden – you need permission to view or
                change them.
              </p>
            ) : (
              GUARANTOR_NUMBERS.map((n) => (
                <GuarantorSection
                  key={n}
                  n={n}
                  enabled={!!form.watch(gKey(n, 'Enabled'))}
                  onToggle={onToggle}
                  errors={errors}
                  thumbState={gThumb[n]}
                  onThumbScan={handleGScan}
                  onThumbClear={handleGClear}
                  onThumbConsent={handleGConsent}
                  scanning={scanning === n}
                  scannerReady={scannerReady}
                  locked={locked}
                />
              ))
            )}
          </div>
        </Form>
      </AppModal>

      <ConfirmDialog
        open={!!removing}
        danger
        title={`Remove Guarantor ${removing || ''}?`}
        message="The guarantor's details and stored documents will be permanently deleted when you save this customer."
        confirmLabel="Remove Guarantor"
        onConfirm={confirmRemove}
        onCancel={() => setRemoving(null)}
      />
    </>
  );
}
