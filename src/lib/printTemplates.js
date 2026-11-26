import { formatPKR, formatNum } from './money';
import { fmtDate, fmtDateTime } from './dates';

// Clean A4 HTML documents (real text, not screenshots). Printed through a hidden iframe.
let biz = {
  businessName: 'Rent a Car',
  phone: '',
  address: '',
  logo: '/images/logo-dark.svg',
  showLogo: true,
  receiptFooter: '',
};
export const setBusinessInfo = (s) => {
  if (s) biz = { ...biz, ...s };
};
const esc = (v) =>
  String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `@page{size:A4 portrait;margin:8mm}
*{box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;color:#0b1c44;font-size:10.5px;margin:0;line-height:1.35}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:2.5px solid #0866f5;padding-bottom:6px;margin-bottom:8px}
.head img{height:40px;max-width:140px;object-fit:contain}
.biz h1{margin:0;font-size:16px;color:#0866f5}
.biz p{margin:1px 0;color:#475569;font-size:10px}
h2{font-size:14px;margin:2px 0 6px;letter-spacing:.3px}
h3{font-size:11px;margin:8px 0 3px;color:#0866f5;border-bottom:1.5px solid #0866f5;padding-bottom:2px}
table{width:100%;border-collapse:collapse;margin:4px 0}
th{background:#eef3fb;text-align:left;font-size:10px;color:#0866f5}
th,td{border:1px solid #d5dfee;padding:3px 5px;vertical-align:top;font-size:10px}
.r{text-align:right}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:2px 16px}
.grid div{padding:1px 0;border-bottom:1px dotted #cbd5e1}
.grid b{color:#475569;font-weight:600;margin-right:4px}
.tot td{font-weight:700;background:#f6f9fe}
.big{font-size:13px;font-weight:700;color:#0866f5}
.sign{display:flex;justify-content:space-between;margin-top:18px;gap:12px}
.sign div{flex:1;border-top:1px solid #0b1c44;padding-top:3px;text-align:center;font-size:9px}
.foot{margin-top:10px;text-align:center;color:#64748b;font-size:9px;border-top:1px solid #e2e8f0;padding-top:4px}
.box{border:1px solid #d5dfee;border-radius:4px;padding:4px 6px;min-height:28px;font-size:10px}
.photos{display:flex;gap:4px;flex-wrap:wrap}
.photos img{height:52px;border:1px solid #d5dfee;border-radius:3px;object-fit:cover}
.thumb-box{width:70px;height:85px;border:1.5px dashed #94a3b8;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;color:#64748b;text-align:center;padding:2px;background:#f8fafc}
.thumb-img{width:70px;height:85px;border:1px solid #d5dfee;border-radius:4px;object-fit:contain;background:#f8fafc}
.doc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}
.doc-grid img{width:100%;height:48px;object-fit:cover;border:1px solid #d5dfee;border-radius:3px}
.doc-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
.doc-grid-3 img{width:100%;height:52px;object-fit:cover;border:1px solid #d5dfee;border-radius:3px}
.sec{margin-bottom:4px}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.compact{font-size:9.5px}
.terms{
  font-size:10px;
  color:#0b1c44;
  line-height:1.5;
  border:1px solid #d5dfee;
  border-radius:5px;
  padding:6px 10px;
  background:#f8fafc;
  margin:4px 0 8px;
}

.terms ol{
  margin:0;
  padding-inline-start:18px;
}

.terms li{
  margin-bottom:4px;
  padding-inline-start:2px;
  white-space:pre-wrap;
  overflow-wrap:anywhere;
  break-inside:avoid;
  page-break-inside:avoid;
}

.terms li:last-child{
  margin-bottom:0;
}

.terms li::marker{
  color:#0866f5;
  font-weight:700;
}

.terms-empty{
  font-size:9px;
  color:#64748b;
  margin:0;
}

h3{
  break-after:avoid;
  page-break-after:avoid;
}
.status-pill{display:inline-block;padding:1px 6px;border-radius:99px;background:#eef3fb;font-size:9px;font-weight:700;color:#0866f5}
.stat-row{display:flex;gap:8px;margin:6px 0}
.stat-box{flex:1;border:1px solid #d5dfee;border-radius:6px;padding:6px 8px;text-align:center;background:#f8fafc}
.stat-box .lbl{font-size:8.5px;color:#64748b;margin:0}
.stat-box .val{font-size:13px;font-weight:700;margin:2px 0 0;color:#0b1c44}
.stat-box .val.green{color:#059669}
.stat-box .val.red{color:#dc2626}
.g-card{border:1px solid #d5dfee;border-radius:6px;padding:6px 8px;margin:4px 0;background:#fafbfd}
.badge-fp{display:inline-block;padding:1px 5px;border-radius:99px;background:#dbeafe;color:#1d4ed8;font-size:8px;font-weight:700}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}*{color-adjust:exact}}`;

const header = (right = '') =>
  `<div class="head"><div style="display:flex;gap:10px;align-items:center">${biz.showLogo && biz.logo
    ? `<img src="${esc(biz.logo.startsWith('/') ? location.origin + biz.logo : biz.logo)}"/>`
    : ''
  }<div class="biz"><h1>${esc(biz.businessName)}</h1><p>${esc(biz.address)}</p><p>Phone: ${esc(biz.phone)}</p></div></div><div class="r">${right}</div></div>`;

const footer = () =>
  `<div class="foot">${esc(biz.receiptFooter || 'Thank you for choosing us. This is a computer-generated agreement.')}</div>`;

const kv = (pairs) =>
  `<div class="grid">${pairs
    .map(([k, v]) => `<div><b>${esc(k)}:</b>${esc(v ?? '-')}</div>`)
    .join('')}</div>`;

const doc = (title, body) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

export function printHtml(html, title = 'Print') {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const w = f.contentWindow;
  w.document.open();
  w.document.write(html);
  w.document.close();

  const go = () => {
    try {
      w.focus();
      w.print();
    } finally {
      setTimeout(() => f.remove(), 3000);
    }
  };

  // Wait for every <img> (customer docs, guarantor docs, thumbs) to load
  // so the print dialog shows complete images, not broken placeholders.
  const waitForImages = () => {
    const imgs = [...w.document.images];
    if (!imgs.length) {
      setTimeout(go, 200);
      return;
    }
    let left = imgs.length;
    const done = () => {
      left -= 1;
      if (left <= 0) setTimeout(go, 150);
    };
    imgs.forEach((img) => {
      if (img.complete && img.naturalWidth > 0) {
        done();
      } else {
        img.onload = done;
        img.onerror = done;
      }
    });
    // Safety timeout – print even if some remote images hang
    setTimeout(() => {
      if (left > 0) {
        left = 0;
        go();
      }
    }, 5000);
  };

  // Give the browser a tick to parse the HTML before checking images
  setTimeout(waitForImages, 50);
}

const bookingRows = (b) => `<table><tr><th>Description</th><th class="r">Amount</th></tr>
<tr><td>Car rent - ${esc(b.carName)} (${esc(b.carPlate)}) · ${b.days} ${b.rateType === 'hourly' ? 'hour(s)' : 'day(s)'} × ${formatPKR(b.rate)}</td><td class="r">${formatPKR(b.rentAmount)}</td></tr>
${(b.charges || []).map((c) => `<tr><td>${esc(c.label)}</td><td class="r">${formatPKR(c.amount)}</td></tr>`).join('')}
<tr class="tot"><td class="r">Total Bill</td><td class="r">${formatPKR(b.total)}</td></tr>
<tr><td class="r">Amount Received</td><td class="r">${formatPKR(b.paid)}</td></tr>
<tr class="tot"><td class="r">Remaining Balance</td><td class="r">${formatPKR(b.balance)}</td></tr></table>
${b.depositPaid ? `<p class="compact">Security deposit received: <b>${formatPKR(b.depositPaid)}</b> (held separately - refundable, not part of the bill). Currently held: <b>${formatPKR(b.depositHeld)}</b></p>` : ''}`;

export const invoiceDoc = (b) =>
  doc(
    `Invoice ${b.invoiceNo}`,
    header(
      `<div class="big">RENTAL INVOICE</div><div>No: <b>${esc(b.invoiceNo)}</b></div><div>Date: ${fmtDate(b.createdAt)}</div>`
    ) +
    kv([
      ['Customer', b.customerName],
      ['Mobile', b.customerMobile],
      ['Booking No', b.number],
      ['Car', `${b.carName} (${b.carPlate})`],
      ['Pick up', fmtDateTime(b.pickupAt)],
      ['Return', fmtDateTime(b.returnAt)],
    ]) +
    bookingRows(b) +
    footer()
  );

export const bookingDoc = (b) =>
  doc(
    `Booking ${b.number}`,
    header(
      `<div class="big">BOOKING CONFIRMATION</div><div>No: <b>${esc(b.number)}</b></div><div>Date: ${fmtDate(b.createdAt)}</div>`
    ) +
    `<h3>Customer & Car</h3>` +
    kv([
      ['Customer', b.customerName],
      ['Mobile', b.customerMobile],
      ['Car', `${b.carName} (${b.carPlate})`],
      ['Driver', b.driverName || 'Not required'],
      ['Pick up', `${fmtDateTime(b.pickupAt)} - ${b.pickupLocation || ''}`],
      ['Return', `${fmtDateTime(b.returnAt)} - ${b.returnLocation || ''}`],
      ['Handled by', b.staffName],
      ['Status', b.displayStatus],
    ]) +
    `<h3>Charges</h3>` +
    bookingRows(b) +
    (b.instructions ? `<h3>Special instructions</h3><div class="box">${esc(b.instructions)}</div>` : '') +
    (
      Array.isArray(b.termsAndConditions) &&
        b.termsAndConditions.length > 0
        ? `<h3>Terms & Conditions</h3>
       <div class="terms">
         <ol>
           ${b.termsAndConditions
          .filter(
            (term) =>
              typeof term === 'string' && term.trim()
          )
          .map(
            (term) => `<li dir="auto">${esc(term.trim())}</li>`
          )
          .join('')}
         </ol>
       </div>`
        : ''
    ) +
    `<div class="sign"><div>Customer signature</div><div>Authorised signature</div></div>` +
    footer()
  );

/**
 * Full one-page Vehicle Rental Agreement.
 * Pass enriched objects: booking (mapped), customer (full), car (full),
 * and optional thumbImageUrl (already authorised).
 */
export function rentalAgreementDoc({
  booking: b,
  customer: c = {},
  car: car = {},
  thumbImageUrl = null,
  inkThumbBox = false,
  staffName = '',
}) {
  const abs = (u) => {
    if (!u) return '';
    const s = String(u).trim();
    if (!s) return '';
    if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:')) {
      return s;
    }
    if (typeof location !== 'undefined' && location.origin) {
      return s.startsWith('/') ? location.origin + s : location.origin + '/' + s;
    }
    return s;
  };

  const imgTag = (url, style) => {
    const src = abs(url);
    if (!src) return '';
    return `<img src="${esc(src)}" style="${style}" onerror="this.style.display='none'"/>`;
  };

  const days = b.days || b.rentalUnits || 1;
  const rate = b.rate ?? b.rentRate ?? 0;
  const rentAmount = b.rentAmount ?? b.rentalAmount ?? 0;
  const total = b.total ?? b.totalAmount ?? 0;
  const paid = b.paid ?? b.totalPaid ?? 0;
  const balance = b.balance ?? Math.max(total - paid, 0);
  const deposit = b.depositPaid ?? b.securityReceived ?? 0;

  const custDocs = [
    ['Photo', c.photo],
    ['CNIC Front', c.cnicFront],
    ['CNIC Back', c.cnicBack],
    ['Licence', c.licenseImage],
  ].filter(([, u]) => u);

  const guarantors = [1, 2]
    .map((n) => ({ n, g: c[`guarantor${n}`] || {} }))
    .filter((x) => x.g && x.g.enabled);

  const carImg = car.image || car.images?.[0] || b.carImage || '';

  // Prefer explicit thumb from print flow; else customer biometric from detail API
  const resolvedThumb =
    thumbImageUrl ||
    c?.biometric?.thumbImage ||
    null;

  const rightHead = `
    <div class="big">VEHICLE RENTAL AGREEMENT</div>
    <div>Booking: <b>${esc(b.number || b.bookingNumber)}</b></div>
    <div>Invoice: <b>${esc(b.invoiceNo || b.invoiceNumber || '-')}</b></div>
    <div>Date: ${fmtDate(b.createdAt || new Date())}</div>
    <div><span class="status-pill">${esc(b.displayStatus || b.status || '')}</span></div>`;

  const customerBlock = `
    <h3>1. Customer</h3>
    <div class="two-col">
      <div>
        ${kv([
    ['Full name', c.name || b.customerName],
    ['Code', c.customerCode || '-'],
    ['Mobile', c.mobile || b.customerMobile],
    ['Alt. mobile', c.alternatePhone || '-'],
    ['Email', c.email || '-'],
    ['CNIC', c.cnic || '-'],
    ['Licence No', c.licenseNo || c.licenseNumber || '-'],
    ['Licence expiry', c.licenseExpiry ? fmtDate(c.licenseExpiry) : '-'],
    ['Address', [c.address, c.city].filter(Boolean).join(', ') || '-'],
    ['Type', c.type || '-'],
    ['Customer since', c.createdAt ? fmtDate(c.createdAt) : '-'],
  ])}
      </div>
      <div style="display:flex;gap:6px;align-items:flex-start;flex-wrap:wrap">
        ${c.photo
      ? imgTag(c.photo, 'width:56px;height:70px;object-fit:cover;border:1px solid #d5dfee;border-radius:4px')
      : ''
    }
        ${carImg
      ? imgTag(carImg, 'width:90px;height:56px;object-fit:contain;border:1px solid #d5dfee;border-radius:4px;background:#f8fafc')
      : ''
    }
      </div>
    </div>
    ${custDocs.length
      ? `<div class="doc-grid" style="margin-top:4px">${custDocs
        .map(
          ([l, u]) =>
            `<div>${imgTag(u, 'width:100%;height:48px;object-fit:cover;border:1px solid #d5dfee;border-radius:3px')}<div class="compact" style="text-align:center">${esc(l)}</div></div>`
        )
        .join('')}</div>`
      : ''
    }`;

  const guarantorBlock =
    guarantors.length > 0
      ? `<h3>Guarantor(s)</h3>${guarantors
        .map(({ n, g }) => {
          const gHasFp = Boolean(g.hasFingerprint || g.biometric?.available);
          const gThumb = g.biometric?.thumbImage || null;
          const gScanned = g.biometric?.scannedAt;
          const gDocs = [];
          if (g.photo) gDocs.push(['Photo', g.photo]);
          if (g.cnicFront) gDocs.push(['CNIC Front', g.cnicFront]);
          if (g.cnicBack) gDocs.push(['CNIC Back', g.cnicBack]);

          const docsHtml =
            gDocs.length > 0
              ? `<div class="doc-grid-3" style="margin:3px 0">${gDocs
                .map(
                  ([l, u]) =>
                    `<div>${imgTag(u, 'width:100%;height:52px;object-fit:cover;border:1px solid #d5dfee;border-radius:3px')}<div class="compact" style="text-align:center">${esc(l)}</div></div>`
                )
                .join('')}</div>`
              : `<div class="box" style="margin:2px 0">No guarantor documents on file</div>`;

          return `<div class="g-card">
              <div class="compact" style="margin-bottom:3px">
                <b style="color:#0866f5">Guarantor ${n}:</b> ${esc(g.name || '-')} · ${esc(g.mobile || '-')}
                ${gHasFp ? ' <span class="badge-fp">Fingerprint</span>' : ''}
              </div>
              ${docsHtml}
              <div style="display:flex;gap:10px;align-items:flex-end;margin-top:4px">
                <div style="text-align:center">
                  ${gThumb
              ? imgTag(gThumb, 'width:56px;height:68px;object-fit:contain;border:1px solid #d5dfee;border-radius:4px;background:#f8fafc')
              : `<div class="thumb-box" style="width:56px;height:68px">Ink thumb<br/>area</div>`
            }
                  <div class="compact" style="margin-top:1px">G${n} thumb</div>
                  ${gScanned ? `<div class="compact" style="color:#64748b">${fmtDate(gScanned)}</div>` : ''}
                </div>
                <div style="flex:1;border-top:1px solid #0b1c44;padding-top:2px;text-align:center;font-size:8.5px;min-width:100px">
                  Guarantor ${n} signature
                </div>
              </div>
            </div>`;
        })
        .join('')}`
      : '';

  const carBlock = `
    <h3>2. Vehicle</h3>
    ${kv([
    ['Name / Model', `${car.name || b.carName || ''} ${car.year ? `(${car.year})` : ''}`.trim()],
    ['Brand', car.brand || '-'],
    ['Number plate', car.plate || car.numberPlate || b.carPlate || '-'],
    ['Colour', car.color || '-'],
    ['Fuel / Transmission', `${car.fuel || car.fuelType || '-'} / ${car.transmission || '-'}`],
    ['Seats', car.seats || car.seatingCapacity || '-'],
    ['Chassis', car.chassisNumber || '-'],
    ['Engine', car.engineNumber || '-'],
    ['Odometer', car.odometer != null ? `${formatNum(car.odometer)} km` : '-'],
  ])}`;

  const rentalBlock = `
    <h3>3. Rental Details</h3>
    ${kv([
    ['Pick up', `${fmtDateTime(b.pickupAt || b.pickupDate)} · ${b.pickupLocation || '-'}`],
    ['Return', `${fmtDateTime(b.returnAt || b.returnDate)} · ${b.returnLocation || '-'}`],
    ['Duration', `${days} day${days === 1 ? '' : 's'}`],
    ['Daily rent (agreed)', formatPKR(rate)],
    ['Rental amount', formatPKR(rentAmount)],
    ['Driver', b.driverName || 'Self-drive'],
    ['Responsible staff', b.staffName || staffName || '-'],
    ['Payment method', b.method || '-'],
  ])}
    ${(b.charges || []).length ? `<table style="margin-top:2px"><tr><th>Additional charge</th><th class="r">Amount</th></tr>${(b.charges || []).map((x) => `<tr><td>${esc(x.label)}</td><td class="r">${formatPKR(x.amount)}</td></tr>`).join('')}</table>` : ''}
    <table style="margin-top:4px">
      <tr class="tot"><td>Total Bill</td><td class="r">${formatPKR(total)}</td></tr>
      <tr><td>Advance received</td><td class="r">${formatPKR(paid)}</td></tr>
      <tr><td>Security deposit (held separately)</td><td class="r">${formatPKR(deposit)}</td></tr>
      <tr class="tot"><td>Remaining balance</td><td class="r">${formatPKR(balance)}</td></tr>
    </table>
    ${b.instructions ? `<div class="box" style="margin-top:4px"><b>Special instructions:</b> ${esc(b.instructions)}</div>` : ''}`;

  const biometricBlock = `
    <h3>5. Biometric & Signatures</h3>
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">
      <div style="text-align:center">
        ${resolvedThumb
      ? imgTag(resolvedThumb, 'width:70px;height:85px;object-fit:contain;border:1px solid #d5dfee;border-radius:4px;background:#f8fafc')
      : inkThumbBox
        ? `<div class="thumb-box">Ink thumbprint<br/>area</div>`
        : `<div class="thumb-box">No thumbprint<br/>on file</div>`
    }
        <div class="compact" style="margin-top:2px">Customer thumb</div>
      </div>
      <div class="sign" style="flex:1;margin-top:0;min-width:200px">
        <div>Customer signature<br/><span class="compact">Date: ${fmtDate(new Date())}</span></div>
        <div>Authorised employee<br/><span class="compact">${esc(b.staffName || staffName || '')}</span></div>
      </div>
    </div>`;

  const bookingTerms = Array.isArray(b.termsAndConditions)
    ? b.termsAndConditions
      .filter((term) => typeof term === 'string')
      .map((term) => term.trim())
      .filter(Boolean)
    : [];

  const terms = `
  <h3>4. Terms & Conditions</h3>

  <div class="terms">
    ${bookingTerms.length > 0
      ? `<ol>
            ${bookingTerms
        .map(
          (term) => `<li dir="auto">${esc(term)}</li>`
        )
        .join('')}
           </ol>`
      : `<p class="terms-empty">
            No additional Terms & Conditions recorded.
           </p>`
    }
  </div>`;

  return doc(
    `Rental Agreement ${b.number || b.bookingNumber}`,
    header(rightHead) +
    customerBlock +
    guarantorBlock +
    carBlock +
    rentalBlock +
    terms +
    biometricBlock +
    footer()
  );
}

export const receiptDoc = (p, b) =>
  doc(
    `Receipt ${p.receiptNo}`,
    header(
      `<div class="big">PAYMENT RECEIPT</div><div>No: <b>${esc(p.receiptNo)}</b></div><div>Date: ${fmtDateTime(p.date)}</div>`
    ) +
    kv([
      ['Received from', p.customerName || b?.customerName],
      ['Booking', p.bookingNumber || b?.number],
      ['Payment type', p.type],
      ['Payment method', p.method],
      ['Received by', p.receivedByName || ''],
    ]) +
    `<table><tr><th>Details</th><th class="r">Amount</th></tr><tr><td>${esc(p.type)} - ${esc(p.note || p.bookingNumber || '')}</td><td class="r big">${formatPKR(p.amount)}</td></tr></table>` +
    (b
      ? `<p class="compact">Total bill: <b>${formatPKR(b.total)}</b> &nbsp; Received so far: <b>${formatPKR(b.paid)}</b> &nbsp; Remaining: <b>${formatPKR(b.balance)}</b></p>`
      : '') +
    `<div class="sign"><div>Customer signature</div><div>Received by</div></div>` +
    footer()
  );

export const ledgerDoc = (l, range) =>
  doc(
    `Statement ${l.customer.name}`,
    header(
      `<div class="big">CUSTOMER ACCOUNT (KHATA)</div><div>${range.from ? fmtDate(range.from) : 'Start'} to ${range.to ? fmtDate(range.to) : 'Today'}</div>`
    ) +
    kv([
      ['Customer', l.customer.name],
      ['Mobile', l.customer.mobile],
    ]) +
    `<table><tr><th>Payment Date</th><th>Details</th><th class="r">Total Bill</th><th class="r">Amount Received</th><th class="r">Remaining Balance</th></tr>
  <tr><td></td><td>Opening balance</td><td class="r"></td><td class="r"></td><td class="r">${formatPKR(l.opening)}</td></tr>
  ${l.rows
      .map(
        (r) =>
          `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.details)}</td><td class="r">${r.debit ? formatPKR(r.debit) : ''}</td><td class="r">${r.credit ? formatPKR(r.credit) : ''}</td><td class="r">${formatPKR(r.balance)}</td></tr>`
      )
      .join('')}
  <tr class="tot"><td colspan="2" class="r">Totals</td><td class="r">${formatPKR(l.totals.totalBill)}</td><td class="r">${formatPKR(l.totals.received)}</td><td class="r">${formatPKR(l.totals.balance)}</td></tr></table>
  <p class="compact">Security deposits currently held for this customer: <b>${formatPKR(l.depositsHeld)}</b> (not included above)</p>` +
    footer()
  );

const photos = (arr = []) =>
  arr.length
    ? `<div class="photos">${arr
      .map(
        (u) =>
          `<img src="${esc(u.startsWith('/') ? location.origin + u : u)}"/>`
      )
      .join('')}</div>`
    : '<div class="box">No photos</div>';

export const handoverDoc = (b) =>
  doc(
    `Handover ${b.number}`,
    header(`<div class="big">CAR HANDOVER FORM</div><div>Booking: <b>${esc(b.number)}</b></div>`) +
    kv([
      ['Customer', b.customerName],
      ['Mobile', b.customerMobile],
      ['Car', `${b.carName} (${b.carPlate})`],
      ['Issued at', fmtDateTime(b.issue?.at)],
      ['Meter reading', `${formatNum(b.issue?.meter)} km`],
      ['Fuel level', b.issue?.fuel],
      ['Handed over by', b.issue?.staffName],
    ]) +
    `<h3>Existing damage</h3><div class="box">${esc(b.issue?.damage || 'No damage recorded')}</div><h3>Condition photos</h3>${photos(b.issue?.photos)}` +
    `<div class="sign"><div>Customer signature</div><div>Employee signature</div></div>` +
    footer()
  );

export const returnDoc = (b) => {
  const r = b.returnInfo || {};
  return doc(
    `Return ${b.number}`,
    header(`<div class="big">CAR RETURN FORM</div><div>Booking: <b>${esc(b.number)}</b></div>`) +
    `<h3>Before (when issued)</h3>` +
    kv([
      ['Meter', `${formatNum(b.issue?.meter)} km`],
      ['Fuel', b.issue?.fuel],
      ['Damage', b.issue?.damage || 'None'],
    ]) +
    `<h3>After (when returned)</h3>` +
    kv([
      ['Returned at', fmtDateTime(r.at)],
      ['Meter', `${formatNum(r.meter)} km`],
      ['Fuel', r.fuel],
      ['New damage', r.damage || 'None'],
      ['Received by', r.staffName],
      ['Distance', `${formatNum((r.meter || 0) - (b.issue?.meter || 0))} km`],
    ]) +
    `<h3>Final charges</h3><table><tr><th>Item</th><th class="r">Amount</th></tr><tr><td>Rent (${b.days} ${b.rateType === 'hourly' ? 'hours' : 'days'})</td><td class="r">${formatPKR(b.rentAmount)}</td></tr>
  <tr><td>Late return (${r.extraDays || 0} extra day/s)</td><td class="r">${formatPKR(r.lateCharge)}</td></tr><tr><td>Extra kilometres (${formatNum(r.extraKm)} km)</td><td class="r">${formatPKR(r.extraKmCharge)}</td></tr>
  <tr><td>Damage / other charges</td><td class="r">${formatPKR((r.damageCharge || 0) + (r.otherCharge || 0))}</td></tr><tr class="tot"><td class="r">Final Total</td><td class="r">${formatPKR(b.total)}</td></tr>
  <tr><td class="r">Received</td><td class="r">${formatPKR(b.paid)}</td></tr><tr class="tot"><td class="r">Remaining</td><td class="r">${formatPKR(b.balance)}</td></tr></table>
  <p class="compact">Security deposit adjusted: <b>${formatPKR(r.depositAdjusted)}</b> &nbsp; Deposit refunded: <b>${formatPKR(r.depositRefunded)}</b></p><h3>Return photos</h3>${photos(r.photos)}` +
    `<div class="sign"><div>Customer signature</div><div>Employee signature</div></div>` +
    footer()
  );
};

/**
 * Full colourful A4 customer details print.
 * Includes: profile, documents, fingerprint (or blank ink box),
 * guarantors with their docs + fingerprints, financial summary.
 * @param {object} c  – full customer from getCustomer (documents:true)
 * @param {boolean} can – sensitive/document permission
 */
export const customerDoc = (c, can = false) => {
  const abs = (u) => {
    if (!u) return '';
    const s = String(u).trim();
    if (!s) return '';
    if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('blob:')) {
      return s;
    }
    // Relative app path
    if (typeof location !== 'undefined' && location.origin) {
      return s.startsWith('/') ? location.origin + s : location.origin + '/' + s;
    }
    return s;
  };

  const imgTag = (url, style) => {
    const src = abs(url);
    if (!src) return '';
    return `<img src="${esc(src)}" style="${style}" onerror="this.style.display='none'"/>`;
  };

  const fullAddress = [c.address, c.city].filter(Boolean).join(', ') || '-';
  const hasFp = Boolean(c.hasFingerprint || c.biometric?.available);
  const thumbUrl = can ? (c.biometric?.thumbImage || null) : null;
  const scannedAt = c.biometric?.scannedAt;

  // Customer document images (photo is public; others need permission)
  const custDocs = [];
  if (c.photo) custDocs.push(['Photo', c.photo]);
  if (can) {
    if (c.cnicFront) custDocs.push(['CNIC Front', c.cnicFront]);
    if (c.cnicBack) custDocs.push(['CNIC Back', c.cnicBack]);
    if (c.licenseImage) custDocs.push(['Licence', c.licenseImage]);
  }

  const guarantors = [1, 2]
    .map((n) => ({ n, g: c[`guarantor${n}`] || {} }))
    .filter((x) => x.g && x.g.enabled);

  const rightHead = `
    <div class="big">CUSTOMER DETAILS</div>
    <div>Code: <b>${esc(c.customerCode || '-')}</b></div>
    <div>Printed: ${fmtDateTime(new Date().toISOString())}</div>
    <div>
      <span class="status-pill">${esc(c.status || '')}</span>
      ${c.type ? ` <span class="status-pill">${esc(c.type)}</span>` : ''}
      ${hasFp ? ' <span class="badge-fp">Fingerprint on file</span>' : ''}
    </div>`;

  const profileBlock = `
    <h3>1. Customer Profile</h3>
    <div class="two-col">
      <div>
        ${kv([
    ['Full name', c.name],
    ['Customer code', c.customerCode || '-'],
    ['Mobile', c.mobile],
    ['Alternate phone', c.alternatePhone || '-'],
    ['Email', c.email || '-'],
    ['Gender', c.gender ? String(c.gender).charAt(0).toUpperCase() + String(c.gender).slice(1) : '-'],
    ['Type', c.type || '-'],
    ['Status', c.status || '-'],
    ['CNIC', can ? (c.cnic || '-') : 'Hidden'],
    ['Licence No', can ? (c.licenseNo || c.licenseNumber || '-') : 'Hidden'],
    ['Licence expiry', can && c.licenseExpiry ? fmtDate(c.licenseExpiry) : (can ? '-' : 'Hidden')],
    ['Address', fullAddress],
    ['Customer since', c.createdAt ? fmtDate(c.createdAt) : '-'],
    ...(c.openingBalance != null && c.openingBalance !== undefined
      ? [['Opening balance', formatPKR(c.openingBalance)]]
      : []),
    ...(c.notes ? [['Notes', c.notes]] : []),
  ])}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-start">
        ${c.photo
      ? imgTag(c.photo, 'width:72px;height:90px;object-fit:cover;border:1.5px solid #0866f5;border-radius:6px')
      : `<div class="thumb-box" style="width:72px;height:90px">No photo</div>`
    }
        <div class="stat-row" style="width:100%;flex-direction:column;gap:4px">
          <div class="stat-box"><p class="lbl">Total Bookings</p><p class="val">${esc(c.totalBookings ?? 0)}</p></div>
          <div class="stat-box"><p class="lbl">Total Spent</p><p class="val green">${formatPKR(c.totalSpent)}</p></div>
          <div class="stat-box"><p class="lbl">Remaining Balance</p><p class="val ${(c.pending || 0) > 0 ? 'red' : ''}">${formatPKR(c.pending)}</p></div>
        </div>
      </div>
    </div>`;

  const docsBlock =
    custDocs.length > 0
      ? `<h3>2. Customer Documents</h3>
         <div class="doc-grid">${custDocs
        .map(
          ([l, u]) =>
            `<div>${imgTag(u, 'width:100%;height:52px;object-fit:cover;border:1px solid #d5dfee;border-radius:3px')}<div class="compact" style="text-align:center;margin-top:1px">${esc(l)}</div></div>`
        )
        .join('')}</div>`
      : `<h3>2. Customer Documents</h3><div class="box">${can ? 'No documents uploaded' : 'Documents hidden – no permission'}</div>`;

  const biometricBlock = `
    <h3>3. Customer Thumb Fingerprint</h3>
    <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
      <div style="text-align:center">
        ${thumbUrl
      ? imgTag(thumbUrl, 'width:70px;height:85px;object-fit:contain;border:1px solid #d5dfee;border-radius:4px;background:#f8fafc')
      : `<div class="thumb-box">Ink thumbprint<br/>area<br/>(blank if not scanned)</div>`
    }
        <div class="compact" style="margin-top:2px">Customer thumb</div>
        ${scannedAt ? `<div class="compact" style="color:#64748b">Scanned: ${fmtDate(scannedAt)}</div>` : ''}
      </div>
      <div class="sign" style="flex:1;margin-top:0;min-width:180px">
        <div>Customer signature<br/><span class="compact">Date: ${fmtDate(new Date())}</span></div>
        <div>Authorised employee</div>
      </div>
    </div>`;

  const guarantorBlock =
    guarantors.length > 0
      ? `<h3>4. Guarantor(s)</h3>${guarantors
        .map(({ n, g }) => {
          const gHasFp = Boolean(g.hasFingerprint || g.biometric?.available);
          const gThumb = can ? (g.biometric?.thumbImage || null) : null;
          const gScanned = g.biometric?.scannedAt;

          // Guarantor images: only present when API returned them (documents:true + permission)
          const gDocs = [];
          if (g.photo) gDocs.push(['Photo', g.photo]);
          if (g.cnicFront) gDocs.push(['CNIC Front', g.cnicFront]);
          if (g.cnicBack) gDocs.push(['CNIC Back', g.cnicBack]);

          const docsHtml =
            gDocs.length > 0
              ? `<div class="doc-grid-3" style="margin:4px 0">${gDocs
                .map(
                  ([l, u]) =>
                    `<div>${imgTag(u, 'width:100%;height:56px;object-fit:cover;border:1px solid #d5dfee;border-radius:3px')}<div class="compact" style="text-align:center;margin-top:1px">${esc(l)}</div></div>`
                )
                .join('')}</div>`
              : can
                ? `<div class="box" style="margin:3px 0">No guarantor documents on file</div>`
                : `<div class="box" style="margin:3px 0">Documents hidden – no permission</div>`;

          return `<div class="g-card">
              <div class="compact" style="margin-bottom:3px">
                <b style="color:#0866f5">Guarantor ${n}:</b> ${esc(g.name || '-')} · ${esc(g.mobile || '-')}
                ${gHasFp ? ' <span class="badge-fp">Fingerprint</span>' : ''}
              </div>
              ${docsHtml}
              <div style="display:flex;gap:10px;align-items:flex-end;margin-top:4px">
                <div style="text-align:center">
                  ${gThumb
              ? imgTag(gThumb, 'width:56px;height:68px;object-fit:contain;border:1px solid #d5dfee;border-radius:4px;background:#f8fafc')
              : `<div class="thumb-box" style="width:56px;height:68px">Ink thumb<br/>area</div>`
            }
                  <div class="compact" style="margin-top:1px">G${n} thumb</div>
                  ${gScanned ? `<div class="compact" style="color:#64748b">${fmtDate(gScanned)}</div>` : ''}
                </div>
                <div style="flex:1;border-top:1px solid #0b1c44;padding-top:2px;text-align:center;font-size:8.5px;min-width:100px">
                  Guarantor ${n} signature
                </div>
              </div>
            </div>`;
        })
        .join('')}`
      : '';

  return doc(
    `Customer ${c.name || ''}`,
    header(rightHead) +
    profileBlock +
    docsBlock +
    biometricBlock +
    guarantorBlock +
    footer()
  );
};

export function tableDoc({ title, subtitle = '', columns, rows, totals }) {
  const val = (c, r) => (typeof c.value === 'function' ? c.value(r) : r[c.key]);
  return doc(
    title,
    header(
      `<div class="big">${esc(title)}</div><div>${esc(subtitle)}</div><div>Printed: ${fmtDateTime(new Date().toISOString())}</div>`
    ) +
    `<table><tr>${columns
      .map((c) => `<th${c.right ? ' class="r"' : ''}>${esc(c.header)}</th>`)
      .join('')}</tr>${rows
        .map(
          (r) =>
            `<tr>${columns
              .map((c) => `<td${c.right ? ' class="r"' : ''}>${esc(val(c, r))}</td>`)
              .join('')}</tr>`
        )
        .join('')}
    ${totals
      ? `<tr class="tot">${columns
        .map(
          (c, i) =>
            `<td${c.right ? ' class="r"' : ''}>${esc(totals[c.header] ?? (i === 0 ? 'Total' : ''))}</td>`
        )
        .join('')}</tr>`
      : ''
    }</table>` +
    footer()
  );
}
