'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

import AppModal from '@/components/modals/AppModal';
import Tabs from '@/components/common/Tabs';
import Form from '@/components/forms/Form';
import FormInput from '@/components/forms/FormInput';
import FormSelect from '@/components/forms/FormSelect';
import FormDatePicker from '@/components/forms/FormDatePicker';
import FormImageUpload from '@/components/forms/FormImageUpload';
import FormFileUpload from '@/components/forms/FormFileUpload';
import MoneyInput from '@/components/forms/MoneyInput';
import NumberPlateInput from '@/components/forms/NumberPlateInput';
import FormRadioGroup from '@/components/forms/FormRadioGroup';

import { carSchema } from '@/validations';
import {
  BRAND_MODELS,
  CAR_COLORS,
  FUEL_TYPES,
  TRANSMISSIONS,
  CAR_STATUSES,
} from '@/constants';
import {
  useAddCarMutation,
  useUpdateCarMutation,
  useUploadCarImagesMutation,
  useUploadCarDocumentMutation,
  useRemoveCarImageMutation,
  useSetCarStatusMutation,
} from '@/redux/api/carApi';
import { errorMessage } from '@/redux/api/baseApi';

const EMPTY = {
  brand: '',
  model: '',
  year: new Date().getFullYear(),
  plate: '',
  color: 'White',
  fuel: 'Petrol',
  transmission: 'Automatic',
  seats: 5,
  status: 'Available',
  odometer: 0,
  dailyRate: '',
  hourlyRate: 0,
  insuranceExpiry: '',
  tokenExpiry: '',
  registrationExpiry: '',
  nextServiceDate: '',
  nextOilChangeDate: '',
  image: null,           // File | existing URL string
  registrationDoc: null, // optional
  insuranceDoc: null,    // optional
};

// Map every field to its tab so validation jumps to the correct tab
const TAB_OF = {
  brand: 'basic',
  model: 'basic',
  year: 'basic',
  plate: 'basic',
  color: 'basic',
  fuel: 'basic',
  transmission: 'basic',
  seats: 'basic',
  odometer: 'basic',
  status: 'basic',
  dailyRate: 'pricing',
  hourlyRate: 'pricing',
  insuranceExpiry: 'documents',
  tokenExpiry: 'documents',
  registrationExpiry: 'documents',
  registrationDoc: 'documents',
  insuranceDoc: 'documents',
  nextServiceDate: 'maintenance',
  nextOilChangeDate: 'maintenance',
  image: 'basic',
};

// FormImageUpload / FormFileUpload may hold a File, a compressed Blob, a { file } wrapper,
// or only a preview string (data: / blob: URL). Turn any of these into a real Blob.
const toBlob = async (v) => {
  if (v instanceof Blob) return v;
  if (v?.file instanceof Blob) return v.file;
  const src = typeof v === 'string' ? v : v?.preview || v?.url || v?.src || '';
  if (/^(data|blob):/i.test(src)) {
    try {
      return await (await fetch(src)).blob();
    } catch {
      return null;
    }
  }
  return null; // empty, or an already-saved https URL → nothing new to upload
};

// a value the user picked this time (anything that is not an existing https URL)
const isPicked = (v) => !!v && !(typeof v === 'string' && /^https?:/i.test(v));

// Capitalize words (Title Case) – keeps user input clean and avoids duplicates
const toTitleCase = (str = '') =>
  String(str)
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');

const ALL_BRANDS = Object.keys(BRAND_MODELS || {});
const ALL_MODELS = Object.values(BRAND_MODELS || {}).flat();

export default function CarFormModal({ open, car, onClose }) {
  const editing = !!car?.id;
  const [tab, setTab] = useState('basic');

  const [add, { isLoading: adding }] = useAddCarMutation();
  const [update, { isLoading: saving }] = useUpdateCarMutation();
  const [setStatus] = useSetCarStatusMutation();
  const [uploadImages] = useUploadCarImagesMutation();
  const [uploadDoc] = useUploadCarDocumentMutation();
  const [removeImage] = useRemoveCarImageMutation();

  // status that was shown when the form opened (only manual statuses)
  const initialStatus = useRef('Available');

  const form = useForm({
    resolver: zodResolver(carSchema),
    defaultValues: EMPTY,
    shouldFocusError: true,
  });

  const brandValue = form.watch('brand');
  const busy = adding || saving;

  // Suggestions for the currently typed brand (case-insensitive contains)
  const brandSuggestions = useMemo(() => {
    const q = (brandValue || '').trim().toLowerCase();
    if (!q) return ALL_BRANDS;
    return ALL_BRANDS.filter((b) => b.toLowerCase().includes(q));
  }, [brandValue]);

  // Suggestions for model – prefer models of the typed brand, otherwise all models
  const modelSuggestions = useMemo(() => {
    const brandKey = Object.keys(BRAND_MODELS || {}).find(
      (b) => b.toLowerCase() === (brandValue || '').trim().toLowerCase()
    );
    const list = brandKey ? BRAND_MODELS[brandKey] : ALL_MODELS;
    return list || [];
  }, [brandValue]);

  useEffect(() => {
    if (!open) return;
    setTab('basic');

    // Only Available / Under Repair / Out of Service can be chosen by hand
    initialStatus.current = car?.manualStatus || 'Available';

    form.reset({
      ...EMPTY,
      ...(car || {}),
      status: initialStatus.current,
      plate: car?.plate || car?.numberPlate || '',
      dailyRate: car?.dailyRate ?? car?.dailyRent ?? '',
      hourlyRate: car?.hourlyRate ?? car?.hourlyRent ?? 0,
      fuel: car?.fuel || car?.fuelType || 'Petrol',
      seats: car?.seats ?? car?.seatingCapacity ?? 5,
      image: car?.image || car?.images?.[0] || null,
      // keep null for optional file fields – schema should treat them as optional
      registrationDoc: car?.registrationDoc || car?.registrationDocument || null,
      insuranceDoc: car?.insuranceDoc || car?.insuranceDocument || null,
      tokenExpiry: car?.tokenExpiry || car?.tokenTaxExpiry || '',
      insuranceExpiry: car?.insuranceExpiry || '',
      registrationExpiry: car?.registrationExpiry || '',
      nextServiceDate: car?.nextServiceDate || '',
      nextOilChangeDate: car?.nextOilChangeDate || '',
      brand: car?.brand || '',
      model: car?.model || '',
      year: car?.year || new Date().getFullYear(),
      color: car?.color || 'White',
    });
  }, [open, car]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = async (values) => {
    // Normalize brand / model / color to Title Case so we don't create "toyota" vs "Toyota"
    values.brand = toTitleCase(values.brand);
    values.model = toTitleCase(values.model);
    values.color = toTitleCase(values.color);

    // Read files from the raw form state: the zod resolver output can drop or change
    // file fields (unknown keys are stripped), which made the upload step silently skip.
    const raw = form.getValues();
    const image = await toBlob(raw.image);
    const registrationDoc = await toBlob(raw.registrationDoc);
    const insuranceDoc = await toBlob(raw.insuranceDoc);

    // files the user picked but we could not read → tell them instead of skipping silently
    const unreadable = [
      ['photo', raw.image, image],
      ['registration book', raw.registrationDoc, registrationDoc],
      ['insurance paper', raw.insuranceDoc, insuranceDoc],
    ]
      .filter(([, v, b]) => isPicked(v) && !b)
      .map(([n]) => n);

    if (unreadable.length) {
      console.warn(
        '[CarFormModal] unreadable file value(s):',
        unreadable,
        raw.image,
        raw.registrationDoc,
        raw.insuranceDoc
      );
    }

    // ---------- 1. Text fields only (JSON) ----------
    // Backend aliases are handled inside carApi.mapCarBody
    const fields = {
      brand: values.brand,
      model: values.model,
      year: values.year,
      plate: values.plate,                 // → numberPlate
      color: values.color,
      fuel: values.fuel,                   // → fuelType
      transmission: values.transmission,
      seats: values.seats,                 // → seatingCapacity
      odometer: values.odometer,
      dailyRate: values.dailyRate,         // → dailyRent
      hourlyRate: values.hourlyRate,       // → hourlyRent
      insuranceExpiry: values.insuranceExpiry,
      tokenExpiry: values.tokenExpiry,     // → tokenTaxExpiry
      registrationExpiry: values.registrationExpiry,
      nextServiceDate: values.nextServiceDate,
      nextOilChangeDate: values.nextOilChangeDate,
    };

    let saved;
    try {
      if (editing) {
        // Backend rejects status on PATCH /cars/:id → never send it here
        saved = await update({ id: car.id, ...fields }).unwrap();
      } else {
        // Create – status is allowed
        fields.status = values.status;
        saved = await add(fields).unwrap();
      }
    } catch (e) {
      toast.error(errorMessage(e));
      return;
    }

    const carId = saved?.id || car?.id;

    // Status has its own endpoint. It needs a reason (3+ chars) unless the car becomes
    // Available, and it refuses cars that are booked / on rent. The car details are
    // already saved at this point, so a status failure is reported but not fatal.
    let statusError = null;
    if (editing && values.status !== initialStatus.current) {
      try {
        await setStatus({
          id: car.id,
          status: values.status, // carApi normalises "Under Repair" → maintenance
          statusReason:
            values.status === 'Available'
              ? ''
              : `Marked ${values.status.toLowerCase()} from the car form`,
        }).unwrap();
      } catch (e) {
        statusError = e;
      }
    }

    // ---------- 2. Upload files (only if user picked a new File) ----------
    let uploadError = null;
    try {
      if (image && carId) {
        const oldImage = editing && typeof car?.image === 'string' ? car.image : '';
        await uploadImages({ id: carId, files: [image] }).unwrap();
        // best-effort: remove previous main photo so the new one becomes primary
        if (oldImage) {
          try {
            await removeImage({ id: carId, url: oldImage }).unwrap();
          } catch {
            /* keep old photo if remove fails */
          }
        }
      }

      if (registrationDoc && carId) {
        await uploadDoc({
          id: carId,
          type: 'registration',
          file: registrationDoc,
        }).unwrap();
      }

      if (insuranceDoc && carId) {
        await uploadDoc({
          id: carId,
          type: 'insurance',
          file: insuranceDoc,
        }).unwrap();
      }
    } catch (e) {
      uploadError = e;
    }

    if (statusError) {
      toast.error(
        `Car details saved, but the status was not changed: ${errorMessage(statusError)}`
      );
    }

    if (uploadError) {
      toast.error(
        `Car saved, but a file did not upload: ${errorMessage(uploadError)}. Open the car and try again.`
      );
    } else if (unreadable.length) {
      toast.error(
        `Car saved, but the ${unreadable.join(' and ')} could not be read from the form, so nothing was uploaded. Open the car, choose the file again and save.`
      );
    } else if (!carId && (image || registrationDoc || insuranceDoc)) {
      toast.error(
        'Car saved, but the server did not return its id, so the files were not uploaded.'
      );
    } else if (!statusError) {
      toast.success(editing ? 'Car changes saved successfully' : 'Car saved successfully');
    }
    onClose();
  };

  const onInvalid = (errs) => {
    const first = Object.keys(errs)[0];
    const targetTab = TAB_OF[first] || 'basic';
    setTab(targetTab);

    // Friendly message that mentions the tab so user is not confused
    const tabLabel = {
      basic: 'Basic Information',
      pricing: 'Pricing',
      documents: 'Documents',
      maintenance: 'Maintenance',
    }[targetTab] || targetTab;

    toast.error(`Please check the highlighted fields in the “${tabLabel}” tab.`);
  };

  return (
    <AppModal
      open={open}
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit Car' : 'Add Car'}
      subtitle="Fields marked * are required."
      footer={
        <>
          <button className="btn btn-neutral" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            form="car-form"
            type="submit"
            disabled={busy}
          >
            <Save size={16} />
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Save Car'}
          </button>
        </>
      }
    >
      <Tabs
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: 'basic', label: 'Basic Information' },
          { value: 'pricing', label: 'Pricing' },
          { value: 'documents', label: 'Documents' },
          { value: 'maintenance', label: 'Maintenance' },
        ]}
      />

      <Form
        id="car-form"
        form={form}
        onSubmit={onSubmit}
        onInvalid={onInvalid}
      >
        {/* ---------- BASIC ---------- */}
        <div className={tab === 'basic' ? 'space-y-4' : 'hidden'}>
          <div className="flex flex-wrap gap-5">
            <FormImageUpload
              name="image"
              label="Car Photo"
              width="w-48"
              height="h-32"
            />
            <div className="flex-1 min-w-[250px] grid sm:grid-cols-2 gap-3 content-start">
              {/* Brand – free text + suggestions */}
              <div>
                <FormInput
                  name="brand"
                  label="Brand"
                  required
                  placeholder="e.g. Toyota"
                  list="brand-suggestions"
                  autoComplete="off"
                />
                <datalist id="brand-suggestions">
                  {brandSuggestions.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>

              {/* Model – free text + suggestions based on brand */}
              <div>
                <FormInput
                  name="model"
                  label="Model"
                  required
                  placeholder="e.g. Corolla"
                  list="model-suggestions"
                  autoComplete="off"
                />
                <datalist id="model-suggestions">
                  {modelSuggestions.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              {/* Year – typeable number */}
              <FormInput
                name="year"
                label="Model Year"
                required
                type="number"
                min={1990}
                max={new Date().getFullYear() + 1}
                placeholder="e.g. 2022"
              />

              <NumberPlateInput name="plate" required />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {/* Colour – free text + suggestions */}
            <div>
              <FormInput
                name="color"
                label="Colour"
                placeholder="e.g. White"
                list="color-suggestions"
                autoComplete="off"
              />
              <datalist id="color-suggestions">
                {(CAR_COLORS || []).map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <FormSelect
              name="fuel"
              label="Fuel Type"
              required
              options={FUEL_TYPES}
              placeholder={null}
            />
            <FormSelect
              name="transmission"
              label="Transmission"
              required
              options={TRANSMISSIONS}
              placeholder={null}
            />
            <FormInput
              name="seats"
              label="Seats"
              required
              type="number"
              min={2}
              max={15}
            />
            <MoneyInput
              name="odometer"
              label="Current Meter Reading"
              suffix="km"
              compact
            />
          </div>

          <FormRadioGroup
            name="status"
            label="Car Status"
            required
            options={CAR_STATUSES}
          />
          <p className="text-xs text-muted">
            “Booked” and “On Rent” are set automatically when you book or issue
            a car. Use “Under Repair” to stop bookings.
          </p>
        </div>

        {/* ---------- PRICING ---------- */}
        <div className={tab === 'pricing' ? 'grid sm:grid-cols-2 gap-4' : 'hidden'}>
          <MoneyInput
            name="dailyRate"
            label="Rent Per Day"
            required
            hint="Used for daily bookings"
          />
          <MoneyInput
            name="hourlyRate"
            label="Rent Per Hour"
            hint="Optional – used for hourly bookings"
          />
        </div>

        {/* ---------- DOCUMENTS ---------- */}
        <div className={tab === 'documents' ? 'space-y-4' : 'hidden'}>
          <div className="grid sm:grid-cols-3 gap-3">
            <FormDatePicker name="insuranceExpiry" label="Insurance Expiry Date" />
            <FormDatePicker name="tokenExpiry" label="Token Tax Expiry Date" />
            <FormDatePicker name="registrationExpiry" label="Registration Expiry" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Both documents are optional */}
            <FormFileUpload name="registrationDoc" label="Registration Book" />
            <FormFileUpload name="insuranceDoc" label="Insurance Paper" />
          </div>
          <p className="text-xs text-muted">
            Registration book and insurance paper are optional. You can upload them later.
          </p>
        </div>

        {/* ---------- MAINTENANCE ---------- */}
        <div className={tab === 'maintenance' ? 'grid sm:grid-cols-2 gap-4' : 'hidden'}>
          <FormDatePicker
            name="nextServiceDate"
            label="Next Service Date"
            hint="You will get a reminder"
          />
          <FormDatePicker
            name="nextOilChangeDate"
            label="Next Oil Change Date"
            hint="You will get a reminder"
          />
          <p className="sm:col-span-2 text-sm text-muted">
            To record a service, oil change or repair that was done, open the
            car and press “Add Service Record”.
          </p>
        </div>
      </Form>
    </AppModal>
  );
}