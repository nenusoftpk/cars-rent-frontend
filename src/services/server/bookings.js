import { addDays } from 'date-fns';
import { fail, guard, listify, inList, pad, nextId, pushActivity, decoBookings, decoPayments, findOverlap, carStatus, maps, scopedBookings, myBooking, localNow, num } from './core';
import { calcRental, calcReturn } from '@/lib/pricing';
import { parse, dayOf, toDay, toLocalISO, fmtDate } from '@/lib/dates';
import { formatPKR } from '@/lib/money';
import { sum } from '@/lib/utils';

export function addPayment(db, b, type, amount, method, date, note, userId) {
  if (!(amount > 0)) return null;
  db.counters.payment += 1;
  const p = { id: `pay-${db.counters.payment}`, receiptNo: `${db.settings.receiptPrefix}-${pad(db.counters.payment)}`, bookingId: b.id, customerId: b.customerId, type, amount, method: method || 'Cash', date: date || toLocalISO(new Date()), note: note || '', receivedBy: userId };
  db.payments.push(p); return p;
}
const dupe = (db, id) => { if (!id) return; if (db.requestIds.includes(id)) fail(409, 'This was already saved. Please check the list before saving again.'); db.requestIds.push(id); db.requestIds = db.requestIds.slice(-300); };
const one = (db, user, id) => {
  const raw = db.bookings.find((x) => x.id === id); if (!raw) fail(404, 'Booking not found.');
  if (!myBooking(user, raw)) fail(403, 'This booking is not assigned to you.');
  return raw;
};
const full = (db, id) => decoBookings(db, [db.bookings.find((b) => b.id === id)])[0];

function rental(car, body) { return calcRental({ pickupAt: body.pickupAt, returnAt: body.returnAt, dailyRate: car.dailyRate, hourlyRate: car.hourlyRate, rateType: body.rateType || 'daily' }); }
function checkCar(db, car, body, excludeId) {
  if (car.status === 'Under Repair') fail(409, 'This car is under repair and cannot be booked.');
  const clash = findOverlap(db, car.id, body.pickupAt, body.returnAt, excludeId, localNow());
  if (clash) fail(409, `This car is already booked for these dates (${clash.number}: ${fmtDate(clash.pickupAt)} to ${fmtDate(clash.returnAt)}).`);
}
const charges = (arr = []) => arr.filter((c) => Number(c.amount) > 0).map((c) => ({ label: c.label, amount: Number(c.amount) }));

export function bookingRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const id = segs[1]; const act = segs[2]; const now = localNow();

  if (id === 'availability' && method === 'GET') {
    const car = db.cars.find((c) => c.id === params.carId); if (!car) return { available: true };
    if (car.status === 'Under Repair') return { available: false, message: 'This car is under repair and cannot be booked.' };
    const c = findOverlap(db, car.id, params.from, params.to, params.excludeId, now);
    return c ? { available: false, message: `This car is already booked for these dates (${c.number}: ${fmtDate(c.pickupAt)} to ${fmtDate(c.returnAt)}).`, conflict: c.number } : { available: true };
  }

  if (!id && method === 'GET') {
    guard(user, 'bookings');
    const all = decoBookings(db, scopedBookings(db, user), now); const today = toDay(now);
    const views = {
      all: () => true, upcoming: (b) => b.status === 'Reserved' && parse(b.pickupAt) >= now, reserved: (b) => b.status === 'Reserved', active: (b) => b.status === 'On Rent',
      completed: (b) => b.status === 'Completed', cancelled: (b) => b.status === 'Cancelled', overdue: (b) => b.isOverdue,
      dueToday: (b) => b.status === 'On Rent' && !b.isOverdue && dayOf(b.returnAt) === today, todayNew: (b) => dayOf(b.createdAt) === today && b.status !== 'Cancelled',
    };
    const summary = Object.fromEntries(Object.entries(views).map(([k, f]) => [k, all.filter(f).length]));
    const dateField = params.dateField === 'pickupAt' ? 'pickupAt' : 'createdAt';
    let rows = all.filter(views[params.view] || views.all);
    rows = rows.filter((b) => inList(params.status, b.displayStatus) && inList(params.customerId, b.customerId) && inList(params.carId, b.carId) && inList(params.staffId, b.staffId) && inList(params.paymentStatus, b.paymentStatus));
    return { ...listify(rows, params, { search: (b) => `${b.number} ${b.customerName} ${b.carName} ${b.carPlate} ${b.customerMobile}`, date: (b) => b[dateField], defaultSort: 'createdAt:desc' }), summary };
  }

  if (!id && method === 'POST') {
    guard(user, 'bookings', 'create'); dupe(db, body.requestId);
    const cu = db.customers.find((c) => c.id === body.customerId); const car = db.cars.find((c) => c.id === body.carId);
    if (!cu) fail(400, 'Please select a customer.'); if (!car) fail(400, 'Please select a car.');
    const rt = rental(car, body); if (!rt.valid) fail(400, 'Return date and time must be after the pick up time.');
    checkCar(db, car, body);
    const ch = charges(body.charges); const additionalTotal = sum(ch, (c) => c.amount); const total = rt.amount + additionalTotal;
    const advance = num(body.advance); const deposit = num(body.deposit);
    if (advance > total) fail(400, `Advance cannot be more than the total rent (${formatPKR(total)}).`);
    db.counters.booking += 1; const n = db.counters.booking; const createdAt = toLocalISO(new Date());
    const b = { id: `bk-${n}`, number: `${db.settings.bookingPrefix}-${pad(n)}`, invoiceNo: `${db.settings.invoicePrefix}-${pad(n)}`, customerId: cu.id, carId: car.id, driverId: body.driverId || '', staffId: body.staffId || user.id, createdBy: user.id, createdAt, pickupAt: body.pickupAt, returnAt: body.returnAt, pickupLocation: body.pickupLocation || 'Office Branch', returnLocation: body.returnLocation || 'Same as Pickup', rateType: body.rateType || 'daily', rate: rt.rate, dailyRate: car.dailyRate, hourlyRate: car.hourlyRate, days: rt.units, rentAmount: rt.amount, charges: ch, additionalTotal, deposit, instructions: body.instructions || '', status: 'Reserved', issue: null, returnInfo: null, cancelled: null, history: [{ at: createdAt, text: 'Booking created' }] };
    db.bookings.push(b);
    addPayment(db, b, advance >= total && total > 0 ? 'Full' : 'Advance', advance, body.method, createdAt, 'Advance payment', user.id);
    addPayment(db, b, 'Security Deposit', deposit, body.method, createdAt, 'Security deposit', user.id);
    pushActivity(db, 'booking', 'New Booking', `${cu.name} - ${car.name} (${rt.label})`);
    return full(db, b.id);
  }

  if (!id) fail(405, 'Not allowed');
  const raw = one(db, user, id);

  if (method === 'GET' && !act) {
    guard(user, 'bookings'); const b = full(db, id); const m = maps(db);
    return { ...b, payments: decoPayments(db, db.payments.filter((p) => p.bookingId === id)).sort((a, z) => z.date.localeCompare(a.date)), customer: m.cus[b.customerId], car: m.car[b.carId], driver: m.drv[b.driverId] || null };
  }

  if (method === 'PUT' && !act) {
    guard(user, 'bookings', 'edit');
    if (!['Reserved', 'On Rent'].includes(raw.status)) fail(409, 'Only reserved or active bookings can be changed.');
    const car = db.cars.find((c) => c.id === (body.carId || raw.carId)); const next = { ...raw, ...body, pickupAt: body.pickupAt || raw.pickupAt, returnAt: body.returnAt || raw.returnAt };
    if (raw.status === 'On Rent' && (body.carId && body.carId !== raw.carId)) fail(409, 'You cannot change the car after it has been issued.');
    const rt = rental(car, next); if (!rt.valid) fail(400, 'Return date and time must be after the pick up time.');
    checkCar(db, car, next, id);
    const ch = body.charges ? charges(body.charges) : raw.charges;
    Object.assign(raw, { customerId: next.customerId, carId: car.id, driverId: next.driverId || '', staffId: next.staffId, pickupAt: next.pickupAt, returnAt: next.returnAt, pickupLocation: next.pickupLocation, returnLocation: next.returnLocation, instructions: next.instructions || '', rateType: next.rateType || 'daily', rate: rt.rate, dailyRate: car.dailyRate, hourlyRate: car.hourlyRate, days: rt.units, rentAmount: rt.amount, charges: ch, additionalTotal: sum(ch, (c) => c.amount), deposit: num(body.deposit, raw.deposit) });
    raw.history.push({ at: toLocalISO(new Date()), text: 'Booking details changed' });
    return full(db, id);
  }

  if (act === 'cancel' && method === 'POST') {
    guard(user, 'bookings', 'edit');
    if (raw.status !== 'Reserved') fail(409, raw.status === 'On Rent' ? 'This car is with the customer. Please return the car first.' : 'This booking cannot be cancelled.');
    const b = full(db, id);
    if (body.refundAdvance && b.paid > 0) addPayment(db, raw, 'Advance Refund', b.paid, 'Cash', toLocalISO(new Date()), 'Advance refunded on cancellation', user.id);
    const held = b.depositHeld; if (held > 0) addPayment(db, raw, 'Deposit Refund', held, 'Cash', toLocalISO(new Date()), 'Security deposit returned on cancellation', user.id);
    raw.status = 'Cancelled'; raw.cancelled = { at: toLocalISO(new Date()), reason: body.reason || 'Cancelled by staff' };
    raw.history.push({ at: raw.cancelled.at, text: `Booking cancelled - ${raw.cancelled.reason}` });
    pushActivity(db, 'alert', 'Booking Cancelled', `${b.customerName} - ${b.carName}`); return full(db, id);
  }

  if (act === 'extend' && method === 'POST') {
    guard(user, 'bookings', 'edit');
    if (!['Reserved', 'On Rent'].includes(raw.status)) fail(409, 'Only reserved or active bookings can be extended.');
    if (!body.returnAt || parse(body.returnAt) <= parse(raw.returnAt)) fail(400, 'The new return time must be after the current return time.');
    const car = db.cars.find((c) => c.id === raw.carId); const rt = rental(car, { ...raw, returnAt: body.returnAt });
    const clash = findOverlap(db, car.id, raw.returnAt, body.returnAt, id, localNow()); if (clash) fail(409, `Cannot extend. The car is booked by ${clash.number} from ${fmtDate(clash.pickupAt)}.`);
    raw.history.push({ at: toLocalISO(new Date()), text: `Return extended from ${raw.returnAt.replace('T', ' ')} to ${body.returnAt.replace('T', ' ')}` });
    Object.assign(raw, { returnAt: body.returnAt, days: rt.units, rentAmount: rt.amount }); return full(db, id);
  }

  if (act === 'issue' && method === 'POST') {
    guard(user, 'issue', 'create');
    if (raw.status !== 'Reserved') fail(409, 'Only reserved bookings can be issued.');
    const car = db.cars.find((c) => c.id === raw.carId);
    if (car.status === 'Under Repair') fail(409, 'This car is under repair and cannot be issued.');
    if (db.bookings.some((b) => b.carId === raw.carId && b.status === 'On Rent')) fail(409, 'This car is still out with another customer.');
    if (num(body.meter, -1) < 0) fail(400, 'Please enter the meter reading.');
    const st = db.staff.find((s) => s.id === body.staffId) || user; const at = toLocalISO(new Date());
    raw.issue = { at, meter: num(body.meter), fuel: body.fuel, damage: body.damage || '', photos: body.photos || [], staffId: st.id, staffName: st.name };
    raw.status = 'On Rent'; car.odometer = Math.max(car.odometer, num(body.meter)); raw.history.push({ at, text: 'Car issued to customer' });
    (body.photos || []).forEach((u) => { db.documents.push({ id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ownerType: 'booking', ownerId: id, ownerName: `${raw.number} - ${car.plate}`, type: 'Handover Photo', name: 'handover.jpg', url: u, mime: 'image/jpeg', size: 50000, uploadedAt: at, sensitive: false }); });
    pushActivity(db, 'return', 'Car Issued', `${db.customers.find((c) => c.id === raw.customerId).name} - ${car.name}`); return full(db, id);
  }

  if (act === 'return' && method === 'POST') {
    guard(user, 'issue', 'create');
    if (raw.status !== 'On Rent') fail(409, 'Only active rentals can be returned.');
    if (num(body.meter) < raw.issue.meter) fail(400, `Final meter reading cannot be less than the issue reading (${raw.issue.meter} km).`);
    const before = full(db, id); const at = body.returnedAt || toLocalISO(new Date());
    const calc = calcReturn({ booking: before, settings: db.settings, returnedAt: at, meterOut: raw.issue.meter, meterIn: num(body.meter), damageCharge: num(body.damageCharge), otherCharge: num(body.otherCharge) });
    const newCh = [['Late Return Charge', calc.lateCharge], ['Extra Kilometer Charge', calc.extraKmCharge], ['Damage Charge', num(body.damageCharge)], ['Other Charges', num(body.otherCharge)]].filter(([, a]) => a > 0).map(([label, amount]) => ({ label, amount }));
    raw.charges = [...raw.charges, ...newCh]; raw.additionalTotal += sum(newCh, (c) => c.amount);
    const st = db.staff.find((s) => s.id === body.staffId) || user;
    const pay = num(body.payNow);
    if (pay > calc.customerPays) fail(400, `Payment is more than the amount due (${formatPKR(calc.customerPays)}).`);
    if (pay > 0) addPayment(db, raw, pay >= calc.customerPays ? 'Full' : 'Partial', pay, body.method, at, 'Payment on return', user.id);
    if (calc.depositAdjusted > 0) addPayment(db, raw, 'Deposit Adjustment', calc.depositAdjusted, 'Cash', at, 'Security deposit adjusted against bill', user.id);
    if (calc.depositRefund > 0) addPayment(db, raw, 'Deposit Refund', calc.depositRefund, 'Cash', at, 'Security deposit refunded', user.id);
    raw.returnInfo = { at, meter: num(body.meter), fuel: body.fuel, damage: body.damage || '', photos: body.photos || [], lateCharge: calc.lateCharge, extraDays: calc.extraDays, extraKm: calc.extraKm, extraKmCharge: calc.extraKmCharge, damageCharge: num(body.damageCharge), otherCharge: num(body.otherCharge), staffId: st.id, staffName: st.name, depositAdjusted: calc.depositAdjusted, depositRefunded: calc.depositRefund };
    raw.status = 'Completed'; raw.history.push({ at, text: 'Car returned' });
    const car = db.cars.find((c) => c.id === raw.carId); car.odometer = Math.max(car.odometer, num(body.meter));
    (body.photos || []).forEach((u) => { db.documents.push({ id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, ownerType: 'booking', ownerId: id, ownerName: `${raw.number} - ${car.plate}`, type: 'Return Photo', name: 'return.jpg', url: u, mime: 'image/jpeg', size: 50000, uploadedAt: at, sensitive: false }); });
    pushActivity(db, 'return', 'Car Returned', `${before.customerName} - ${before.carName}`); return full(db, id);
  }
  fail(405, 'Not allowed');
}
