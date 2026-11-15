import { addDays, addHours, setHours, startOfDay, subDays, subHours, differenceInCalendarDays } from 'date-fns';
import { rng } from '@/lib/rng';
import { toLocalISO } from '@/lib/dates';

const pad = (n) => String(n).padStart(4, '0');
const METHODS = ['Cash', 'Cash', 'Cash', 'Cash', 'JazzCash', 'JazzCash', 'Easypaisa', 'Easypaisa', 'Bank Transfer', 'Bank Transfer', 'Other Online Transfer'];
const PHOTOS = ['/images/docs/condition-1.svg', '/images/docs/condition-2.svg', '/images/docs/condition-3.svg'];
const SCENARIOS = ['rentOk', 'rentDueToday', 'overdue2', 'overdue1', 'rentDriver', 'repair', 'reservedSoon', 'reservedSoon2', 'reservedToday', 'freeFar', 'repair', 'free'];

// Builds ~250 bookings + their payments, spread over the last ~6 months, with no overlapping bookings per car.
export function seedBookings({ customers, cars, drivers, staff, now }) {
  const r = rng(77);
  const bookings = []; const payments = [];
  const emps = staff.filter((s) => s.role === 'employee');
  const activeDrivers = drivers.filter((d) => d.status === 'Active');
  const odo = Object.fromEntries(cars.map((c) => [c.id, c.odometer - 9000]));
  let bn = 0; let pn = 0; let cn = 0;
  const at = (d, h) => setHours(startOfDay(d), h);

  const pay = (b, type, amount, method, date, note = '') => {
    if (!(amount > 0)) return;
    pn += 1;
    payments.push({ id: `pay-${pn}`, receiptNo: `RCP-${pad(pn)}`, bookingId: b.id, customerId: b.customerId, type, amount, method, date: toLocalISO(date > now ? now : date), note, receivedBy: b.staffId });
  };

  const make = (car, start, end, status, o = {}) => {
    bn += 1; cn += 1;
    const customer = customers[(cn * 7 + bn) % customers.length];
    const staffM = emps[cn % emps.length];
    const days = Math.max(1, Math.ceil((end - start) / 86400000));
    const late = status === 'Completed' && !o.noLate && r() < 0.1;
    const charges = [];
    if (r() < 0.12) charges.push({ label: 'Extra Kilometer Charge', amount: r.pick([1000, 1500, 2000]) });
    if (late) charges.push({ label: 'Late Return Charge', amount: car.dailyRate });
    const additionalTotal = charges.reduce((s, c) => s + c.amount, 0);
    const rentAmount = days * car.dailyRate; const total = rentAmount + additionalTotal;
    const deposit = status === 'Cancelled' ? 0 : r.pick([0, 5000, 5000, 10000]);
    const createdAt = o.createdAt || subHours(at(subDays(start, r.int(1, 3)), r.int(10, 18)), 0);
    const driver = o.driver ?? (r() < 0.2 && activeDrivers.length ? r.pick(activeDrivers) : null);
    const b = {
      id: `bk-${bn}`, number: `BKG-${pad(bn)}`, invoiceNo: `INV-${pad(bn)}`, customerId: customer.id, carId: car.id, driverId: driver?.id || '', staffId: staffM.id, createdBy: staffM.id,
      createdAt: toLocalISO(createdAt > now ? subHours(now, 1) : createdAt), pickupAt: toLocalISO(start), returnAt: toLocalISO(end), pickupLocation: 'Office Branch', returnLocation: 'Same as Pickup',
      rateType: 'daily', rate: car.dailyRate, dailyRate: car.dailyRate, hourlyRate: car.hourlyRate, days, rentAmount, charges, additionalTotal, deposit, instructions: '', status, issue: null, returnInfo: null, cancelled: null,
      history: [{ at: toLocalISO(createdAt > now ? subHours(now, 1) : createdAt), text: 'Booking created' }],
    };
    const adv = Math.min(total, Math.round((total * r.pick([0.3, 0.4, 0.5])) / 500) * 500);
    const method = r.pick(METHODS);
    if (status !== 'Cancelled' || r() < 0.7) pay(b, 'Advance', adv, method, createdAt, 'Advance payment');
    if (deposit) pay(b, 'Security Deposit', deposit, r.pick(METHODS), createdAt, 'Security deposit');

    if (status === 'Completed' || status === 'On Rent') {
      const m0 = odo[car.id];
      b.issue = { at: b.pickupAt, meter: m0, fuel: 'Full', damage: r() < 0.1 ? 'Small scratch on rear bumper' : '', photos: PHOTOS.slice(0, 2), staffId: staffM.id, staffName: staffM.name };
      b.history.push({ at: b.pickupAt, text: 'Car issued to customer' });
      if (status === 'Completed') {
        const back = late ? addDays(end, 1) : end; const km = days * r.int(90, 190);
        odo[car.id] = m0 + km;
        b.returnInfo = { at: toLocalISO(back), meter: m0 + km, fuel: r.pick(['Full', '3/4', '1/2']), damage: '', photos: PHOTOS.slice(1, 3), lateCharge: late ? car.dailyRate : 0, extraDays: late ? 1 : 0, extraKm: 0, extraKmCharge: 0, damageCharge: 0, otherCharge: 0, staffId: staffM.id, staffName: staffM.name, depositAdjusted: 0, depositRefunded: deposit };
        b.history.push({ at: b.returnInfo.at, text: 'Car returned' });
        const recent = differenceInCalendarDays(now, end) < 25;
        const owe = r() < (recent ? 0.22 : 0.04);
        const remaining = total - adv;
        pay(b, owe ? 'Partial' : 'Full', owe ? Math.round(remaining / 2 / 500) * 500 : remaining, r.pick(METHODS), back, owe ? 'Part payment on return' : 'Final payment on return');
        if (deposit) pay(b, 'Deposit Refund', deposit, 'Cash', back, 'Security deposit returned');
      } else if (r() < 0.4) pay(b, 'Partial', Math.round((total - adv) / 4 / 500) * 500, r.pick(METHODS), addDays(start, 1), 'Part payment');
    }
    if (status === 'Cancelled') {
      b.cancelled = { at: b.createdAt, reason: r.pick(['Customer changed plan', 'Found another car', 'Travel cancelled']) };
      b.history.push({ at: b.createdAt, text: `Booking cancelled - ${b.cancelled.reason}` });
    }
    bookings.push(b);
    return b;
  };

  cars.forEach((car, k) => {
    let t = at(subDays(now, 175 - k * 3), 9 + (k % 4));
    for (;;) {
      const end = addDays(t, r.int(1, 6));
      if (end > subDays(now, 9)) break;
      make(car, t, end, 'Completed');
      t = addDays(end, r.int(2, 8));
    }
    const sc = SCENARIOS[k];
    const D = (n, h = 10) => at(addDays(now, n), h);
    if (sc === 'rentOk') { make(car, D(-2), D(1), 'On Rent'); make(car, D(3), D(6), 'Reserved'); }
    if (sc === 'rentDueToday') { make(car, D(-3), addHours(now, 3), 'On Rent'); make(car, D(4), D(5), 'Reserved'); }
    if (sc === 'overdue2') make(car, D(-6), D(-2), 'On Rent');
    if (sc === 'overdue1') make(car, D(-4), D(-1), 'On Rent');
    if (sc === 'rentDriver') make(car, D(-1), D(4), 'On Rent', { driver: activeDrivers[0] });
    if (sc === 'reservedSoon') make(car, D(1), D(4), 'Reserved', { createdAt: subHours(now, 2) });
    if (sc === 'reservedSoon2') make(car, D(2), D(3), 'Reserved', { createdAt: subHours(now, 5) });
    if (sc === 'reservedToday') make(car, addHours(now, 4), D(3), 'Reserved', { createdAt: subHours(now, 26) });
    if (sc === 'freeFar') make(car, D(8), D(11), 'Reserved', { createdAt: subHours(now, 3) });
    if (k === 9 || k === 11) make(car, D(1), D(2), 'Cancelled', { createdAt: subHours(now, 30) });
    if (k === 11) make(car, D(-12), D(-10), 'Cancelled', { createdAt: subDays(now, 14) });
  });
  cars.forEach((c) => { c.odometer = odo[c.id]; });
  bookings.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return { bookings, payments, counters: { booking: bn, payment: pn } };
}
