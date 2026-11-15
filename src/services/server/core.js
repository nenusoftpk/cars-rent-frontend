import { addDays } from 'date-fns';
import { parse, dayOf, toDay, inRange } from '@/lib/dates';
import { sum } from '@/lib/utils';
import { RENT_RECEIPT_TYPES } from '@/constants';
import { hasPerm } from '@/constants/permissions';

export const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
export const can = hasPerm;
export const guard = (u, module, action = 'view') => { if (!can(u, `${module}:${action}`)) fail(403, 'You do not have permission to do this.'); };
export const needFinancial = (u) => { if (!can(u, 'financial:view')) fail(403, 'Financial information is available to the owner only.'); };
export const needAdmin = (u) => { if (u.role !== 'admin') fail(403, 'Only the owner can do this.'); };
export const allRecords = (u) => u.role === 'admin' || can(u, 'records:all');

export const isRentReceipt = (p) => RENT_RECEIPT_TYPES.includes(p.type);
export const netReceipt = (p) => (isRentReceipt(p) ? p.amount : p.type === 'Advance Refund' ? -p.amount : 0);

export const inList = (value, v) => !value || String(value).split(',').includes(String(v));
export const num = (v, d = 0) => (v === '' || v == null || Number.isNaN(Number(v)) ? d : Number(v));

export function sortRows(rows, sort, fallback) {
  const [key, dir] = (sort || fallback || '').split(':');
  if (!key) return rows;
  const m = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key]; const y = b[key];
    if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })) * m;
  });
}
export function paginate(rows, p) {
  const pageSize = Math.min(Math.max(num(p.pageSize, 10), 1), 10000); const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize)); const page = Math.min(Math.max(num(p.page, 1), 1), totalPages);
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, totalPages };
}
export function listify(rows, p, { search, date, defaultSort } = {}) {
  let r = rows;
  if (p.search && search) { const q = String(p.search).toLowerCase().trim(); r = r.filter((x) => search(x).toLowerCase().includes(q)); }
  if ((p.from || p.to) && date) r = r.filter((x) => inRange(date(x), p.from, p.to));
  return paginate(sortRows(r, p.sort, defaultSort), p);
}

export const nextId = (db, key, prefix) => { db.counters[key] = (db.counters[key] || 0) + 1; return `${prefix}-${db.counters[key]}`; };
export const pad = (n) => String(n).padStart(4, '0');
export const pushActivity = (db, type, title, text) => { db.activity.unshift({ id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, at: new Date().toISOString().slice(0, 16), type, title, text }); db.activity = db.activity.slice(0, 60); };
export const localNow = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()); };

// ---------- lookups & decorators ----------
export const maps = (db) => ({
  cus: Object.fromEntries(db.customers.map((x) => [x.id, x])), car: Object.fromEntries(db.cars.map((x) => [x.id, x])),
  drv: Object.fromEntries(db.drivers.map((x) => [x.id, x])), stf: Object.fromEntries(db.staff.map((x) => [x.id, x])),
});
export function payAgg(payments) {
  const by = {};
  payments.forEach((p) => {
    const a = (by[p.bookingId] ||= { paid: 0, depositPaid: 0, depositRefunded: 0, depositAdjusted: 0, count: 0 });
    a.count += 1;
    if (p.type === 'Security Deposit') a.depositPaid += p.amount;
    else if (p.type === 'Deposit Refund') a.depositRefunded += p.amount;
    else if (p.type === 'Deposit Adjustment') { a.depositAdjusted += p.amount; a.paid += p.amount; } else a.paid += netReceipt(p);
  });
  return by;
}
export function decoBookings(db, list = db.bookings, now = localNow()) {
  const m = maps(db); const agg = payAgg(db.payments);
  return list.map((b) => {
    const a = agg[b.id] || { paid: 0, depositPaid: 0, depositRefunded: 0, depositAdjusted: 0 };
    const cu = m.cus[b.customerId]; const car = m.car[b.carId];
    const total = b.rentAmount + b.additionalTotal; const isOverdue = b.status === 'On Rent' && parse(b.returnAt) < now;
    const lateDays = isOverdue ? Math.max(1, Math.ceil((now - parse(b.returnAt)) / 86400000)) : 0;
    return {
      ...b, total, paid: a.paid, balance: b.status === 'Cancelled' ? 0 : total - a.paid, creditBalance: b.status === 'Cancelled' ? a.paid : 0,
      depositPaid: a.depositPaid, depositRefunded: a.depositRefunded, depositAdjusted: a.depositAdjusted, depositHeld: a.depositPaid - a.depositRefunded - a.depositAdjusted,
      customerName: cu?.name || '-', customerMobile: cu?.mobile || '', customerPhoto: cu?.photo || '', carName: car?.name || '-', carPlate: car?.plate || '', carImage: car?.image || '',
      driverName: m.drv[b.driverId]?.name || '', staffName: m.stf[b.staffId]?.name || '', isOverdue, lateDays, displayStatus: isOverdue ? 'Overdue' : b.status,
      paymentStatus: b.status === 'Cancelled' ? 'Cancelled' : total - a.paid <= 0 ? 'Paid' : a.paid > 0 ? 'Partial' : 'Unpaid',
    };
  });
}
export function decoPayments(db, list = db.payments) {
  const m = maps(db); const bk = Object.fromEntries(db.bookings.map((b) => [b.id, b]));
  return list.map((p) => ({ ...p, customerName: m.cus[p.customerId]?.name || '-', bookingNumber: bk[p.bookingId]?.number || '-', carName: m.car[bk[p.bookingId]?.carId]?.name || '-', carId: bk[p.bookingId]?.carId, receivedByName: m.stf[p.receivedBy]?.name || '' }));
}
export const myBooking = (u, b) => allRecords(u) || b.staffId === u.id || b.createdBy === u.id;
export const scopedBookings = (db, u) => db.bookings.filter((b) => myBooking(u, b));
export const scopedCustomers = (db, u) => {
  if (allRecords(u)) return db.customers;
  const mine = new Set(scopedBookings(db, u).map((b) => b.customerId));
  return db.customers.filter((c) => c.createdBy === u.id || mine.has(c.id));
};
export const scopedPayments = (db, u) => {
  if (allRecords(u)) return db.payments;
  const ids = new Set(scopedBookings(db, u).map((b) => b.id));
  return db.payments.filter((p) => p.receivedBy === u.id || ids.has(p.bookingId));
};

export const maskCnic = (c = '') => (c.length >= 14 ? `${c.slice(0, 6)}*****${c.slice(-4)}` : '*****');
export function maskCustomer(u, c) {
  if (can(u, 'sensitive:view')) return c;
  return { ...c, cnic: maskCnic(c.cnic), licenseNo: c.licenseNo ? `****${c.licenseNo.slice(-3)}` : '', cnicFront: null, cnicBack: null, licenseImage: null, locked: true };
}

export function carStatus(db, car, now = localNow()) {
  if (car.status === 'Under Repair') return 'Under Repair';
  if (db.bookings.some((b) => b.carId === car.id && b.status === 'On Rent')) return 'On Rent';
  const today = toDay(now);
  if (db.bookings.some((b) => b.carId === car.id && b.status === 'Reserved' && dayOf(b.pickupAt) <= today)) return 'Booked';
  return car.status;
}
export function findOverlap(db, carId, from, to, excludeId, now = localNow()) {
  const a = parse(from); const z = parse(to);
  return db.bookings.find((b) => {
    if (b.carId !== carId || b.id === excludeId || !['Reserved', 'On Rent'].includes(b.status)) return false;
    const s = parse(b.pickupAt); let e = parse(b.returnAt); if (b.status === 'On Rent' && e < now) e = addDays(now, 0);
    return s < z && e > a;
  });
}
export const sumPay = (list) => sum(list, netReceipt);
