'use client';
/**
 * Shared print flow for the one-page Vehicle Rental Agreement.
 * Used by New Booking success modal, Booking Detail, and All Bookings actions.
 *
 * Flow:
 * 1. Load full customer + car when IDs are known (list/detail only have snapshots).
 * 2. If customer already has a stored thumb image → print immediately.
 * 3. Otherwise open biometric choice modal (manual / SecuGen / blank ink box).
 * 4. Optional save-to-customer only with explicit consent.
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  Fingerprint,
  Printer,
  Upload,
  Wifi,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import AppModal from '@/components/modals/AppModal';
import { useLazyGetCustomerQuery, useUpdateCustomerMutation } from '@/redux/api/customerApi';
import { useLazyGetCarQuery } from '@/redux/api/carApi';
import { errorMessage } from '@/redux/api/baseApi';
import { useAuth } from '@/hooks/useAuth';
import { printHtml, rentalAgreementDoc } from '@/lib/printTemplates';
import { captureSecuGenThumb, checkSecuGenAvailable } from '@/lib/secugenCapture';
import { isBrowserOnline } from '@/offline/offlineAdapter';

export function useRentalAgreementPrint() {
  const { user } = useAuth();
  const [fetchCustomer] = useLazyGetCustomerQuery();
  const [fetchCar] = useLazyGetCarQuery();
  const [updateCustomer] = useUpdateCustomerMutation();

  const [bioModal, setBioModal] = useState(null); // { booking, customer, car }
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(null);
  const [thumbConsent, setThumbConsent] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(null);
  const [inkOnly, setInkOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  const printAgreement = useCallback(
    ({ booking, customer, car, thumbImageUrl, inkThumbBox }) => {
      const html = rentalAgreementDoc({
        booking,
        customer: customer || {},
        car: car || {},
        thumbImageUrl,
        inkThumbBox,
        staffName: booking?.staffName || user?.name || '',
      });
      printHtml(html, `Agreement ${booking?.number || booking?.bookingNumber || ''}`);
    },
    [user?.name]
  );

  /**
   * Entry point. Pass a mapped booking (list/detail) or the enriched success object.
   * Optional preloaded customer/car avoid extra fetches (e.g. New Booking page).
   */
  const startPrintAgreement = useCallback(
    async (booking, { customer: preCustomer, car: preCar } = {}) => {
      if (!booking) return;
      setLoading(true);
      try {
        let customer = preCustomer || null;
        let car = preCar || null;

        const customerId = booking.customerId || booking.customer?.id;
        const carId = booking.carId || booking.car?.id;

        if (!customer && customerId) {
          try {
            customer = await fetchCustomer(customerId).unwrap();
          } catch {
            /* fall back to booking snapshot fields */
          }
        }
        if (!car && carId) {
          try {
            car = await fetchCar(carId).unwrap();
          } catch {
            /* fall back to booking snapshot fields */
          }
        }

        // Normalise snapshot fields so the template still works without full records
        const enrichedBooking = {
          ...booking,
          customerName: booking.customerName || customer?.name,
          customerMobile: booking.customerMobile || customer?.mobile,
          carName: booking.carName || car?.name,
          carPlate: booking.carPlate || car?.plate,
          carImage: booking.carImage || car?.image,
        };

        const thumbUrl =
          customer?.biometric?.thumbImage ||
          customer?.thumbImage ||
          null;
        const hasBio =
          Boolean(
            customer?.hasFingerprint ||
              customer?.biometric?.available ||
              thumbUrl
          ) && Boolean(thumbUrl);

        if (hasBio) {
          printAgreement({
            booking: enrichedBooking,
            customer,
            car,
            thumbImageUrl: thumbUrl,
            inkThumbBox: false,
          });
          return;
        }

        // No stored biometric → choice modal
        setThumbFile(null);
        setThumbPreview(null);
        setThumbConsent(false);
        setInkOnly(false);
        setScannerReady(null);
        setBioModal({ booking: enrichedBooking, customer, car });
        try {
          const ok = await checkSecuGenAvailable();
          setScannerReady(ok);
        } catch {
          setScannerReady(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchCustomer, fetchCar, printAgreement]
  );

  const handleScanThumb = async () => {
    if (!isBrowserOnline()) {
      toast.error('Fingerprint capture requires an internet connection.');
      return;
    }
    setScanning(true);
    try {
      const result = await captureSecuGenThumb();
      setThumbFile(result.file);
      setThumbPreview(result.dataUrl);
      setThumbConsent(false);
      setInkOnly(false);
      toast.success('Thumb scanned successfully');
    } catch (err) {
      toast.error(err?.message || 'Could not capture fingerprint. Check the scanner.');
    } finally {
      setScanning(false);
    }
  };

  const handleManualThumbFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    setThumbFile(file);
    setInkOnly(false);
    const reader = new FileReader();
    reader.onload = () => setThumbPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const finishBioAndPrint = async (saveToCustomer) => {
    const ctx = bioModal;
    if (!ctx) return;

    let thumbUrl = null;
    let useInk = inkOnly;

    if (saveToCustomer && thumbFile && thumbConsent) {
      try {
        await updateCustomer({
          id: ctx.customer?.id || ctx.booking.customerId,
          thumbImage: thumbFile,
          biometricConsent: 'true',
        }).unwrap();
        toast.success('Fingerprint saved to customer record');
        thumbUrl = thumbPreview;
      } catch (e) {
        toast.error(
          `Could not save fingerprint: ${errorMessage(e)}. Printing with current image only.`
        );
        thumbUrl = thumbPreview;
      }
    } else if (thumbPreview && !inkOnly) {
      thumbUrl = thumbPreview;
    } else {
      useInk = true;
    }

    printAgreement({
      booking: ctx.booking,
      customer: ctx.customer,
      car: ctx.car,
      thumbImageUrl: thumbUrl,
      inkThumbBox: useInk,
    });
    setBioModal(null);
  };

  const biometricDialog = (
    <AppModal
      open={!!bioModal}
      onClose={() => setBioModal(null)}
      title="Add Customer Thumbprint"
      subtitle="Choose how to include the customer’s thumbprint on the rental agreement."
      size="md"
      footer={
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <button className="btn btn-neutral" onClick={() => setBioModal(null)}>
            Cancel
          </button>
          <button
            className="btn btn-outline flex-1"
            onClick={() => {
              setInkOnly(true);
              setThumbFile(null);
              setThumbPreview(null);
              finishBioAndPrint(false);
            }}
          >
            Print with blank ink box
          </button>
          <button
            className="btn btn-primary flex-1"
            onClick={() => finishBioAndPrint(!!(thumbFile && thumbConsent))}
            disabled={scanning}
          >
            <Printer size={16} />
            {thumbFile && thumbConsent
              ? 'Save & Print'
              : thumbPreview
                ? 'Print with this image'
                : 'Print'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-line p-3 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-2">
              <Upload size={15} /> Manual thumbprint image
            </p>
            <p className="text-xs text-muted">
              Upload an existing scan or photo of an ink thumbprint.
            </p>
            <label className="btn btn-neutral btn-sm w-full cursor-pointer">
              <Upload size={14} />
              Choose image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleManualThumbFile}
              />
            </label>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-3 space-y-2">
            <p className="font-semibold text-sm flex items-center gap-2">
              <Fingerprint size={15} className="text-primary" /> Scan with SecuGen
            </p>
            <div className="flex items-center gap-1.5 text-xs">
              {scannerReady === null ? (
                <span className="text-muted">Checking scanner…</span>
              ) : scannerReady ? (
                <span className="text-success flex items-center gap-1">
                  <Wifi size={12} /> Scanner ready
                </span>
              ) : (
                <span className="text-warning flex items-center gap-1">
                  <WifiOff size={12} /> Scanner not detected
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm w-full"
              onClick={handleScanThumb}
              disabled={scanning || !isBrowserOnline()}
            >
              {scanning ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Scanning…
                </>
              ) : (
                <>
                  <Fingerprint size={14} /> Scan Thumb
                </>
              )}
            </button>
            {!isBrowserOnline() && (
              <p className="text-xs text-danger">
                Fingerprint capture requires an internet connection.
              </p>
            )}
          </div>
        </div>

        {(thumbPreview || inkOnly) && (
          <div className="flex flex-col sm:flex-row gap-4 items-start rounded-xl border border-line bg-soft p-3">
            <div className="w-24 h-32 rounded-xl border border-line bg-white overflow-hidden grid place-items-center shrink-0">
              {thumbPreview ? (
                <img
                  src={thumbPreview}
                  alt="Thumb preview"
                  className="size-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-muted text-center px-2">
                  Blank ink box will be printed
                </span>
              )}
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {thumbFile && (
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="size-4 mt-0.5 accent-primary cursor-pointer shrink-0"
                    checked={thumbConsent}
                    onChange={(e) => setThumbConsent(e.target.checked)}
                  />
                  <span className="text-xs leading-snug">
                    Customer has given consent to store this fingerprint image
                    securely for identification purposes. (Required only if you
                    want to save it to the customer record.)
                  </span>
                </label>
              )}
              <p className="text-xs text-muted">
                You can print with the image for this agreement only, or save it
                to the customer for future use (requires consent).
              </p>
            </div>
          </div>
        )}
      </div>
    </AppModal>
  );

  return {
    startPrintAgreement,
    biometricDialog,
    printing: loading,
  };
}
