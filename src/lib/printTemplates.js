import { formatPKR, formatNum } from './money';
import { fmtDate, fmtDateTime } from './dates';

// Clean A4 HTML documents (real text, not screenshots). Printed through a hidden iframe.
let biz = { businessName: 'Rent a Car', phone: '', address: '', logo: '/images/logo-dark.svg', showLogo: true, receiptFooter: '' };
export const setBusinessInfo = (s) => { if (s) biz = { ...biz, ...s }; };
const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#0b1c44;font-size:12px;margin:0}
.head{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0866f5;padding-bottom:10px;margin-bottom:14px}
.head img{height:46px;max-width:160px;object-fit:contain}.biz h1{margin:0;font-size:20px}.biz p{margin:2px 0;color:#475569}
h2{font-size:17px;margin:4px 0 10px}h3{font-size:13px;margin:16px 0 6px;color:#0866f5}
table{width:100%;border-collapse:collapse;margin:6px 0}th{background:#eef3fb;text-align:left}th,td{border:1px solid #d5dfee;padding:6px 8px;vertical-align:top}
.r{text-align:right}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}.grid div{padding:3px 0;border-bottom:1px dotted #cbd5e1}.grid b{color:#475569;font-weight:600;margin-right:6px}
.tot td{font-weight:700;background:#f6f9fe}.big{font-size:15px;font-weight:700}.sign{display:flex;justify-content:space-between;margin-top:60px}.sign div{width:42%;border-top:1px solid #0b1c44;padding-top:5px;text-align:center}
.foot{margin-top:24px;text-align:center;color:#64748b;font-size:11px;border-top:1px solid #e2e8f0;padding-top:8px}.box{border:1px solid #d5dfee;border-radius:6px;padding:8px;min-height:50px}
.photos{display:flex;gap:6px;flex-wrap:wrap}.photos img{height:70px;border:1px solid #d5dfee;border-radius:4px}`;

const header = (right = '') => `<div class="head"><div style="display:flex;gap:12px;align-items:center">${biz.showLogo && biz.logo ? `<img src="${esc(biz.logo.startsWith('/') ? location.origin + biz.logo : biz.logo)}"/>` : ''}<div class="biz"><h1>${esc(biz.businessName)}</h1><p>${esc(biz.address)}</p><p>Phone: ${esc(biz.phone)}</p></div></div><div class="r">${right}</div></div>`;
const footer = () => `<div class="foot">${esc(biz.receiptFooter || 'Thank you for choosing us.')}</div>`;
const kv = (pairs) => `<div class="grid">${pairs.map(([k, v]) => `<div><b>${esc(k)}:</b>${esc(v)}</div>`).join('')}</div>`;
const doc = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;

export function printHtml(html, title = 'Print') {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  const w = f.contentWindow; w.document.open(); w.document.write(html); w.document.close();
  const go = () => { try { w.focus(); w.print(); } finally { setTimeout(() => f.remove(), 2000); } };
  const imgs = [...w.document.images]; let left = imgs.length;
  if (!left) return setTimeout(go, 150);
  const done = () => { left -= 1; if (left <= 0) setTimeout(go, 100); };
  imgs.forEach((i) => (i.complete ? done() : ((i.onload = done), (i.onerror = done))));
  setTimeout(() => { if (left > 0) { left = 0; go(); } }, 2500);
}

const bookingRows = (b) => `<table><tr><th>Description</th><th class="r">Amount</th></tr>
<tr><td>Car rent - ${esc(b.carName)} (${esc(b.carPlate)}) · ${b.days} ${b.rateType === 'hourly' ? 'hour(s)' : 'day(s)'} × ${formatPKR(b.rate)}</td><td class="r">${formatPKR(b.rentAmount)}</td></tr>
${(b.charges || []).map((c) => `<tr><td>${esc(c.label)}</td><td class="r">${formatPKR(c.amount)}</td></tr>`).join('')}
<tr class="tot"><td class="r">Total Bill</td><td class="r">${formatPKR(b.total)}</td></tr>
<tr><td class="r">Amount Received</td><td class="r">${formatPKR(b.paid)}</td></tr>
<tr class="tot"><td class="r">Remaining Balance</td><td class="r">${formatPKR(b.balance)}</td></tr></table>
${b.depositPaid ? `<p>Security deposit received: <b>${formatPKR(b.depositPaid)}</b> (held separately - refundable, not part of the bill). Currently held: <b>${formatPKR(b.depositHeld)}</b></p>` : ''}`;

export const invoiceDoc = (b) => doc(`Invoice ${b.invoiceNo}`, header(`<div class="big">RENTAL INVOICE</div><div>No: <b>${esc(b.invoiceNo)}</b></div><div>Date: ${fmtDate(b.createdAt)}</div>`) +
  kv([['Customer', b.customerName], ['Mobile', b.customerMobile], ['Booking No', b.number], ['Car', `${b.carName} (${b.carPlate})`], ['Pick up', fmtDateTime(b.pickupAt)], ['Return', fmtDateTime(b.returnAt)]]) + bookingRows(b) + footer());

export const bookingDoc = (b) => doc(`Booking ${b.number}`, header(`<div class="big">BOOKING CONFIRMATION</div><div>No: <b>${esc(b.number)}</b></div><div>Date: ${fmtDate(b.createdAt)}</div>`) +
  `<h3>Customer & Car</h3>` + kv([['Customer', b.customerName], ['Mobile', b.customerMobile], ['Car', `${b.carName} (${b.carPlate})`], ['Driver', b.driverName || 'Not required'], ['Pick up', `${fmtDateTime(b.pickupAt)} - ${b.pickupLocation || ''}`], ['Return', `${fmtDateTime(b.returnAt)} - ${b.returnLocation || ''}`], ['Handled by', b.staffName], ['Status', b.displayStatus]]) +
  `<h3>Charges</h3>` + bookingRows(b) + (b.instructions ? `<h3>Special instructions</h3><div class="box">${esc(b.instructions)}</div>` : '') +
  `<div class="sign"><div>Customer signature</div><div>Authorised signature</div></div>` + footer());

export const receiptDoc = (p, b) => doc(`Receipt ${p.receiptNo}`, header(`<div class="big">PAYMENT RECEIPT</div><div>No: <b>${esc(p.receiptNo)}</b></div><div>Date: ${fmtDateTime(p.date)}</div>`) +
  kv([['Received from', p.customerName || b?.customerName], ['Booking', p.bookingNumber || b?.number], ['Payment type', p.type], ['Payment method', p.method], ['Received by', p.receivedByName || '']]) +
  `<table><tr><th>Details</th><th class="r">Amount</th></tr><tr><td>${esc(p.type)} - ${esc(p.note || p.bookingNumber || '')}</td><td class="r big">${formatPKR(p.amount)}</td></tr></table>` +
  (b ? `<p>Total bill: <b>${formatPKR(b.total)}</b> &nbsp; Received so far: <b>${formatPKR(b.paid)}</b> &nbsp; Remaining: <b>${formatPKR(b.balance)}</b></p>` : '') +
  `<div class="sign"><div>Customer signature</div><div>Received by</div></div>` + footer());

export const ledgerDoc = (l, range) => doc(`Statement ${l.customer.name}`, header(`<div class="big">CUSTOMER ACCOUNT (KHATA)</div><div>${range.from ? fmtDate(range.from) : 'Start'} to ${range.to ? fmtDate(range.to) : 'Today'}</div>`) +
  kv([['Customer', l.customer.name], ['Mobile', l.customer.mobile]]) +
  `<table><tr><th>Payment Date</th><th>Details</th><th class="r">Total Bill</th><th class="r">Amount Received</th><th class="r">Remaining Balance</th></tr>
  <tr><td></td><td>Opening balance</td><td class="r"></td><td class="r"></td><td class="r">${formatPKR(l.opening)}</td></tr>
  ${l.rows.map((r) => `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.details)}</td><td class="r">${r.debit ? formatPKR(r.debit) : ''}</td><td class="r">${r.credit ? formatPKR(r.credit) : ''}</td><td class="r">${formatPKR(r.balance)}</td></tr>`).join('')}
  <tr class="tot"><td colspan="2" class="r">Totals</td><td class="r">${formatPKR(l.totals.totalBill)}</td><td class="r">${formatPKR(l.totals.received)}</td><td class="r">${formatPKR(l.totals.balance)}</td></tr></table>
  <p>Security deposits currently held for this customer: <b>${formatPKR(l.depositsHeld)}</b> (not included above)</p>` + footer());

const photos = (arr = []) => (arr.length ? `<div class="photos">${arr.map((u) => `<img src="${esc(u.startsWith('/') ? location.origin + u : u)}"/>`).join('')}</div>` : '<div class="box">No photos</div>');
export const handoverDoc = (b) => doc(`Handover ${b.number}`, header(`<div class="big">CAR HANDOVER FORM</div><div>Booking: <b>${esc(b.number)}</b></div>`) +
  kv([['Customer', b.customerName], ['Mobile', b.customerMobile], ['Car', `${b.carName} (${b.carPlate})`], ['Issued at', fmtDateTime(b.issue?.at)], ['Meter reading', `${formatNum(b.issue?.meter)} km`], ['Fuel level', b.issue?.fuel], ['Handed over by', b.issue?.staffName]]) +
  `<h3>Existing damage</h3><div class="box">${esc(b.issue?.damage || 'No damage recorded')}</div><h3>Condition photos</h3>${photos(b.issue?.photos)}` +
  `<div class="sign"><div>Customer signature</div><div>Employee signature</div></div>` + footer());

export const returnDoc = (b) => { const r = b.returnInfo || {}; return doc(`Return ${b.number}`, header(`<div class="big">CAR RETURN FORM</div><div>Booking: <b>${esc(b.number)}</b></div>`) +
  `<h3>Before (when issued)</h3>` + kv([['Meter', `${formatNum(b.issue?.meter)} km`], ['Fuel', b.issue?.fuel], ['Damage', b.issue?.damage || 'None']]) +
  `<h3>After (when returned)</h3>` + kv([['Returned at', fmtDateTime(r.at)], ['Meter', `${formatNum(r.meter)} km`], ['Fuel', r.fuel], ['New damage', r.damage || 'None'], ['Received by', r.staffName], ['Distance', `${formatNum((r.meter || 0) - (b.issue?.meter || 0))} km`]]) +
  `<h3>Final charges</h3><table><tr><th>Item</th><th class="r">Amount</th></tr><tr><td>Rent (${b.days} ${b.rateType === 'hourly' ? 'hours' : 'days'})</td><td class="r">${formatPKR(b.rentAmount)}</td></tr>
  <tr><td>Late return (${r.extraDays || 0} extra day/s)</td><td class="r">${formatPKR(r.lateCharge)}</td></tr><tr><td>Extra kilometres (${formatNum(r.extraKm)} km)</td><td class="r">${formatPKR(r.extraKmCharge)}</td></tr>
  <tr><td>Damage / other charges</td><td class="r">${formatPKR((r.damageCharge || 0) + (r.otherCharge || 0))}</td></tr><tr class="tot"><td class="r">Final Total</td><td class="r">${formatPKR(b.total)}</td></tr>
  <tr><td class="r">Received</td><td class="r">${formatPKR(b.paid)}</td></tr><tr class="tot"><td class="r">Remaining</td><td class="r">${formatPKR(b.balance)}</td></tr></table>
  <p>Security deposit adjusted: <b>${formatPKR(r.depositAdjusted)}</b> &nbsp; Deposit refunded: <b>${formatPKR(r.depositRefunded)}</b></p><h3>Return photos</h3>${photos(r.photos)}` +
  `<div class="sign"><div>Customer signature</div><div>Employee signature</div></div>` + footer()); };

export const customerDoc = (c, can) => doc(`Customer ${c.name}`, header('<div class="big">CUSTOMER DETAILS</div>') +
  kv([['Name', c.name], ['Mobile', c.mobile], ['Address', `${c.address}${c.city ? ', ' + c.city : ''}`], ['CNIC', can ? c.cnic : 'Hidden'], ['Licence No', can ? c.licenseNo || '-' : 'Hidden'], ['Total bookings', c.totalBookings], ['Total spent', formatPKR(c.totalSpent)], ['Remaining balance', formatPKR(c.pending)]]) + footer());

export function tableDoc({ title, subtitle = '', columns, rows, totals }) {
  const val = (c, r) => (typeof c.value === 'function' ? c.value(r) : r[c.key]);
  return doc(title, header(`<div class="big">${esc(title)}</div><div>${esc(subtitle)}</div><div>Printed: ${fmtDateTime(new Date().toISOString())}</div>`) +
    `<table><tr>${columns.map((c) => `<th${c.right ? ' class="r"' : ''}>${esc(c.header)}</th>`).join('')}</tr>${rows.map((r) => `<tr>${columns.map((c) => `<td${c.right ? ' class="r"' : ''}>${esc(val(c, r))}</td>`).join('')}</tr>`).join('')}
    ${totals ? `<tr class="tot">${columns.map((c, i) => `<td${c.right ? ' class="r"' : ''}>${esc(totals[c.header] ?? (i === 0 ? 'Total' : ''))}</td>`).join('')}</tr>` : ''}</table>` + footer());
}
