import { subMonths, format, startOfMonth } from 'date-fns';
import { fail, guard, can, needFinancial, listify, paginate, sortRows, inList, nextId, pushActivity, decoBookings, decoPayments, carStatus, maps, scopedBookings, scopedPayments, scopedCustomers, myBooking, netReceipt, isRentReceipt, localNow, num, allRecords } from './core';
import { addPayment } from './bookings';
import { getReminders } from './system';
import { inRange, dayOf, toDay, toLocalISO, groupKey, groupLabel, fmtDate } from '@/lib/dates';
import { sum } from '@/lib/utils';
import { formatPKR } from '@/lib/money';

export function paymentRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const now = localNow();
  if (segs[0] === 'payments' && !segs[1] && method === 'GET') {
    guard(user, 'billing');
    const all = decoPayments(db, scopedPayments(db, user));
    const rows = all.filter((p) => inList(params.method, p.method) && inList(params.type, p.type) && inList(params.customerId, p.customerId) && inList(params.bookingId, p.bookingId));
    const filteredRange = rows.filter((p) => inRange(p.date, params.from, params.to));
    const summary = { received: sum(filteredRange, netReceipt), count: filteredRange.length, depositsIn: sum(filteredRange.filter((p) => p.type === 'Security Deposit'), (p) => p.amount), depositsOut: sum(filteredRange.filter((p) => p.type === 'Deposit Refund'), (p) => p.amount) };
    return { ...listify(rows, params, { search: (p) => `${p.receiptNo} ${p.customerName} ${p.bookingNumber} ${p.carName}`, date: (p) => p.date, defaultSort: 'date:desc' }), summary };
  }
  if (segs[0] === 'payments' && !segs[1] && method === 'POST') {
    guard(user, 'billing', 'create');
    if (body.requestId) { if (db.requestIds.includes(body.requestId)) fail(409, 'This payment was already saved.'); db.requestIds.push(body.requestId); db.requestIds = db.requestIds.slice(-300); }
    const raw = db.bookings.find((b) => b.id === body.bookingId); if (!raw) fail(404, 'Booking not found.');
    if (!myBooking(user, raw)) fail(403, 'This booking is not assigned to you.');
    const b = decoBookings(db, [raw], now)[0]; const amount = num(body.amount); if (!(amount > 0)) fail(400, 'Please enter the amount received.');
    let type = body.type || 'Partial';
    if (type === 'Deposit Refund') { if (amount > b.depositHeld) fail(400, `Refund cannot be more than the deposit held (${formatPKR(b.depositHeld)}).`); }
    else if (type === 'Security Deposit') { /* any amount */ }
    else {
      if (raw.status === 'Cancelled') fail(409, 'This booking is cancelled.');
      if (amount > b.balance) fail(400, `Amount is more than the remaining balance (${formatPKR(b.balance)}).`);
      type = amount >= b.balance ? 'Full' : type === 'Full' ? 'Partial' : type;
    }
    const p = addPayment(db, raw, type, amount, body.method, body.date ? (body.date.length === 10 ? `${body.date}T${toLocalISO(new Date()).slice(11)}` : body.date) : toLocalISO(new Date()), body.note, user.id);
    pushActivity(db, 'payment', type === 'Deposit Refund' ? 'Deposit Refunded' : 'Payment Received', `${formatPKR(amount)} - ${b.customerName}`);
    return decoPayments(db, [p])[0];
  }
  if (segs[0] === 'invoices' && method === 'GET') {
    guard(user, 'billing');
    const all = decoBookings(db, scopedBookings(db, user), now).filter((b) => b.status !== 'Cancelled');
    const rows = all.filter((b) => inList(params.paymentStatus, b.paymentStatus) && inList(params.customerId, b.customerId) && inList(params.carId, b.carId));
    const summary = { billed: sum(rows, (b) => b.total), received: sum(rows, (b) => b.paid), pending: sum(rows, (b) => Math.max(b.balance, 0)), count: rows.length };
    return { ...listify(rows, params, { search: (b) => `${b.invoiceNo} ${b.number} ${b.customerName} ${b.carName}`, date: (b) => b.createdAt, defaultSort: 'createdAt:desc' }), summary };
  }
  if (segs[0] === 'deposits' && method === 'GET') {
    guard(user, 'billing');
    const all = decoBookings(db, scopedBookings(db, user), now).filter((b) => b.depositPaid > 0);
    const rows = all.filter((b) => (params.state === 'held' ? b.depositHeld > 0 : params.state === 'returned' ? b.depositHeld <= 0 : true) && inList(params.customerId, b.customerId));
    const summary = { held: sum(all, (b) => Math.max(b.depositHeld, 0)), count: all.filter((b) => b.depositHeld > 0).length };
    return { ...listify(rows, params, { search: (b) => `${b.number} ${b.customerName} ${b.carName}`, date: (b) => b.createdAt, defaultSort: 'createdAt:desc' }), summary };
  }
  fail(404, 'Not found');
}

// ---------- Income & Expenses (owner view) ----------
function incomeExpenseRows(db, p) {
  const m = maps(db); const bk = Object.fromEntries(db.bookings.map((b) => [b.id, b]));
  const rows = [];
  db.payments.forEach((x) => {
    const net = netReceipt(x); if (!net) return; const b = bk[x.bookingId];
    rows.push({ key: x.id, kind: 'Income', type: x.type === 'Advance Refund' ? 'Advance Refunded' : 'Rental Income', date: x.date, details: `Car Rental (${b?.days || ''} ${b?.rateType === 'hourly' ? 'Hours' : 'Days'}) - ${b?.number || ''} - ${x.type}`, carId: b?.carId || '', carName: m.car[b?.carId]?.name || '', carPlate: m.car[b?.carId]?.plate || '', carImage: m.car[b?.carId]?.image || '', customerId: x.customerId, party: m.cus[x.customerId]?.name || '', partyPhoto: m.cus[x.customerId]?.photo || '', method: x.method, income: net, expense: 0, bookingId: x.bookingId, paymentId: x.id });
  });
  db.expenses.forEach((e) => rows.push({ key: e.id, kind: 'Expense', type: e.category, date: e.date, details: e.details, carId: e.carId || '', carName: m.car[e.carId]?.name || '', carPlate: m.car[e.carId]?.plate || '', carImage: m.car[e.carId]?.image || '', customerId: '', party: e.supplier || '', partyPhoto: '', method: e.method, income: 0, expense: e.amount, expenseId: e.id }));
  return rows.filter((r) => inRange(r.date, p.from, p.to) && inList(p.carId, r.carId) && inList(p.method, r.method) && (!p.customerId || r.customerId === p.customerId) && (p.type === 'Income' ? r.kind === 'Income' : p.type === 'Expenses' ? r.kind === 'Expense' : true));
}
export function incomeExpenseRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx;
  if (segs[0] === 'income-expenses') {
    guard(user, 'expenses'); needFinancial(user);
    const rows = incomeExpenseRows(db, params);
    const totals = { income: sum(rows, (r) => r.income), expense: sum(rows, (r) => r.expense) }; totals.profit = totals.income - totals.expense;
    const by = params.groupBy;
    if (by) {
      const g = {}; rows.forEach((r) => { const k = groupKey(r.date, by); const x = (g[k] ||= { key: k, date: k, groupDate: k, kind: 'Group', type: 'Summary', details: '', income: 0, expense: 0, entries: 0 }); x.income += r.income; x.expense += r.expense; x.entries += 1; });
      const list = Object.values(g).map((x) => ({ ...x, date: x.key, label: groupLabel(x.key, by), details: `${x.entries} entr${x.entries === 1 ? 'y' : 'ies'}`, profit: x.income - x.expense }));
      return { ...paginate(sortRows(list, params.sort, 'date:desc'), params), totals, grouped: true };
    }
    return { ...paginate(sortRows(rows.map((r) => ({ ...r, profit: r.income - r.expense })), params.sort, 'date:desc'), params), totals, grouped: false };
  }
  // expenses CRUD
  const id = segs[1];
  guard(user, 'expenses', method === 'POST' ? 'create' : method === 'PUT' ? 'edit' : 'delete'); needFinancial(user);
  if (method === 'POST') {
    const carCats = ['Petrol', 'Repair', 'Service', 'Oil Change', 'Insurance & Tax'];
    if (carCats.includes(body.category) && !body.carId) fail(400, 'Please select the car for this expense.');
    if (!carCats.includes(body.category)) body.carId = '';
    const e = { id: nextId(db, 'expense', 'exp'), date: body.date.length === 10 ? `${body.date}T09:00` : body.date, category: body.category, details: body.details, carId: body.carId || '', supplier: body.supplier || '', method: body.method, amount: num(body.amount), createdBy: user.id };
    db.expenses.push(e); pushActivity(db, 'payment', 'Expense Added', `${e.category} - ${formatPKR(e.amount)}`); return e;
  }
  const e = db.expenses.find((x) => x.id === id); if (!e) fail(404, 'Expense not found.');
  if (method === 'PUT') { const carCats = ['Petrol', 'Repair', 'Service', 'Oil Change', 'Insurance & Tax']; Object.assign(e, body, { id, amount: num(body.amount, e.amount) }); if (!carCats.includes(e.category)) e.carId = ''; if (e.date.length === 10) e.date += 'T09:00'; return e; }
  if (method === 'DELETE') { db.expenses = db.expenses.filter((x) => x.id !== id); return { ok: true }; }
  fail(405, 'Not allowed');
}

// ---------- Ledger (Khata) ----------
export function ledgerRoutes(ctx) {
  const { db, user, params, segs } = ctx; guard(user, 'ledger');
  const cu = db.customers.find((c) => c.id === segs[1]); if (!cu) fail(404, 'Please select a customer.');
  if (!scopedCustomers(db, user).some((c) => c.id === cu.id)) fail(403, 'This customer is not assigned to you.');
  const bks = decoBookings(db, scopedBookings(db, user).filter((b) => b.customerId === cu.id));
  const entries = [];
  bks.filter((b) => b.status !== 'Cancelled').forEach((b) => entries.push({ date: b.createdAt, details: `Booking ${b.number} - ${b.carName} (${b.days} ${b.rateType === 'hourly' ? 'hours' : 'days'})`, debit: b.total, credit: 0, ref: b.number, bookingId: b.id }));
  db.payments.filter((p) => p.customerId === cu.id && bks.some((b) => b.id === p.bookingId)).forEach((p) => {
    const b = bks.find((x) => x.id === p.bookingId);
    if (isRentReceipt(p)) entries.push({ date: p.date, details: `${p.type === 'Deposit Adjustment' ? 'Deposit used for bill' : 'Payment received'} (${p.type === 'Deposit Adjustment' ? 'Security deposit' : p.method}) - ${b.number}`, debit: 0, credit: p.amount, ref: p.receiptNo, bookingId: b.id });
    else if (p.type === 'Advance Refund') entries.push({ date: p.date, details: `Advance refunded - ${b.number}`, debit: p.amount, credit: 0, ref: p.receiptNo, bookingId: b.id });
  });
  entries.sort((a, b) => a.date.localeCompare(b.date));
  let opening = cu.openingBalance || 0; const inside = [];
  entries.forEach((e) => { if (params.from && dayOf(e.date) < params.from) opening += e.debit - e.credit; else if (!params.to || dayOf(e.date) <= params.to) inside.push(e); });
  let bal = opening; const rows = inside.map((e) => { bal += e.debit - e.credit; return { ...e, balance: bal }; });
  const totals = { totalBill: sum(rows, (r) => r.debit), received: sum(rows, (r) => r.credit), balance: bal };
  return { customer: { id: cu.id, name: cu.name, mobile: cu.mobile, photo: cu.photo }, opening, rows, totals, depositsHeld: sum(bks, (b) => Math.max(b.depositHeld, 0)) };
}

// ---------- Dashboard ----------
export function dashboardRoute(ctx) {
  const { db, user } = ctx; const now = localNow(); const today = toDay(now); const fin = can(user, 'financial:view');
  const bks = decoBookings(db, scopedBookings(db, user), now);
  const cars = db.cars.map((c) => ({ ...c, st: carStatus(db, c, now) }));
  const cnt = (s) => cars.filter((c) => c.st === s).length;
  const pays = scopedPayments(db, user);
  const stats = {
    totalCars: cars.length, available: cnt('Available'), booked: cnt('Booked'), onRent: cnt('On Rent'), repair: cnt('Under Repair'),
    todayBookings: bks.filter((b) => dayOf(b.createdAt) === today && b.status !== 'Cancelled').length,
    dueToday: bks.filter((b) => b.status === 'On Rent' && !b.isOverdue && dayOf(b.returnAt) === today).length, overdue: bks.filter((b) => b.isOverdue).length,
    todayIncome: fin ? sum(pays.filter((p) => dayOf(p.date) === today), netReceipt) : null, pending: fin ? sum(bks.filter((b) => b.status !== 'Cancelled'), (b) => Math.max(b.balance, 0)) : null,
  };
  let monthly = null;
  if (fin) {
    monthly = Array.from({ length: 6 }, (_, i) => { const d = subMonths(startOfMonth(now), 5 - i); const k = format(d, 'yyyy-MM'); return { month: format(d, 'MMM'), key: k, income: sum(db.payments.filter((p) => dayOf(p.date).startsWith(k)), netReceipt), expenses: sum(db.expenses.filter((e) => dayOf(e.date).startsWith(k)), (e) => e.amount) }; });
  }
  const m = maps(db);
  const alerts = bks.filter((b) => b.isOverdue).map((b) => ({ id: `al-${b.id}`, at: b.returnAt, type: 'alert', title: 'Overdue Alert', text: `${b.customerName} has not returned ${b.carName}` }));
  const activity = [...db.activity.filter((a) => dayOf(a.at) === today || true), ...alerts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 6);
  const reminders = getReminders(db, user, now).filter((r) => !r.completed && r.view !== 'Overdue').sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  return {
    stats, scope: allRecords(user) ? 'business' : 'own', monthly, activity,
    latestBookings: [...bks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5),
    overdueList: bks.filter((b) => b.isOverdue).slice(0, 4), reminders, financialLocked: !fin,
    totals: fin ? { income: sum(monthly, (x) => x.income), expenses: sum(monthly, (x) => x.expenses) } : null, carsByStatus: [{ name: 'Available', value: cnt('Available') + cnt('Booked'), color: '#00b873' }, { name: 'On Rent', value: cnt('On Rent'), color: '#0866f5' }, { name: 'Under Repair', value: cnt('Under Repair'), color: '#ff8a1f' }], _m: !!m,
  };
}

// ---------- Reports ----------
export function reportRoutes(ctx) {
  const { db, user, params, segs } = ctx; const name = segs[1]; const now = localNow(); guard(user, 'reports');
  const FIN = ['daily-income', 'monthly-income', 'daily-expenses', 'monthly-expenses', 'car-income', 'car-expenses', 'car-profit', 'maintenance', 'repairs'];
  if (FIN.includes(name)) needFinancial(user);
  const m = maps(db); const bks = decoBookings(db, scopedBookings(db, user), now);
  const inR = (v) => inRange(v, params.from, params.to); let rows = []; let totals = null;
  const money = ['Cash', 'JazzCash', 'Easypaisa', 'Bank Transfer', 'Other Online Transfer'];

  if (name === 'cars-status') rows = db.cars.map((c) => { const st = carStatus(db, c, now); const b = bks.find((x) => x.carId === c.id && x.status === 'On Rent'); return { id: c.id, car: c.name, plate: c.plate, status: st, customer: b?.customerName || '-', dueBack: b?.returnAt || '', dailyRate: c.dailyRate, odometer: c.odometer }; }).filter((r) => inList(params.status, r.status) && inList(params.carId, r.id));
  if (name === 'customers') { const by = {}; bks.filter((b) => b.status !== 'Cancelled' && inR(b.createdAt)).forEach((b) => { const x = (by[b.customerId] ||= { id: b.customerId, customer: b.customerName, mobile: b.customerMobile, bookings: 0, billed: 0, received: 0, balance: 0 }); x.bookings += 1; x.billed += b.total; x.received += b.paid; x.balance += b.balance; }); rows = Object.values(by).filter((r) => inList(params.customerId, r.id)); totals = { billed: sum(rows, (r) => r.billed), received: sum(rows, (r) => r.received), balance: sum(rows, (r) => r.balance) }; }
  if (name === 'bookings') { rows = bks.filter((b) => inR(b.createdAt) && inList(params.status, b.displayStatus) && inList(params.carId, b.carId) && inList(params.customerId, b.customerId) && inList(params.staffId, b.staffId)); totals = { total: sum(rows, (r) => r.total), paid: sum(rows, (r) => r.paid), balance: sum(rows, (r) => r.balance) }; }
  if (name === 'outstanding') { rows = bks.filter((b) => b.status !== 'Cancelled' && b.balance > 0 && inR(b.createdAt) && inList(params.customerId, b.customerId) && inList(params.carId, b.carId)); totals = { total: sum(rows, (r) => r.total), paid: sum(rows, (r) => r.paid), balance: sum(rows, (r) => r.balance) }; }
  if (name === 'daily-income' || name === 'monthly-income') {
    const by = name.startsWith('daily') ? 'day' : 'month'; const g = {};
    db.payments.filter((p) => netReceipt(p) && inR(p.date) && inList(params.carId, bks.find((b) => b.id === p.bookingId)?.carId || '')).forEach((p) => { const k = groupKey(p.date, by); const x = (g[k] ||= { key: k, period: groupLabel(k, by), entries: 0, total: 0, ...Object.fromEntries(money.map((mm) => [mm, 0])) }); x.entries += 1; x.total += netReceipt(p); x[p.method] += netReceipt(p); });
    rows = Object.values(g).sort((a, b) => b.key.localeCompare(a.key)); totals = { total: sum(rows, (r) => r.total) };
  }
  if (name === 'daily-expenses' || name === 'monthly-expenses') {
    const by = name.startsWith('daily') ? 'day' : 'month'; const g = {}; const cats = ['Petrol', 'Repair', 'Service', 'Oil Change', 'Insurance & Tax', 'Salary', 'Office Expense', 'Other'];
    db.expenses.filter((e) => inR(e.date) && inList(params.carId, e.carId)).forEach((e) => { const k = groupKey(e.date, by); const x = (g[k] ||= { key: k, period: groupLabel(k, by), entries: 0, total: 0, ...Object.fromEntries(cats.map((c) => [c, 0])) }); x.entries += 1; x.total += e.amount; x[e.category] += e.amount; });
    rows = Object.values(g).sort((a, b) => b.key.localeCompare(a.key)); totals = { total: sum(rows, (r) => r.total) };
  }
  if (['car-income', 'car-expenses', 'car-profit'].includes(name)) {
    rows = db.cars.filter((c) => inList(params.carId, c.id)).map((c) => {
      const income = sum(db.payments.filter((p) => inR(p.date) && bks.some((b) => b.id === p.bookingId && b.carId === c.id)), netReceipt); const exp = db.expenses.filter((e) => e.carId === c.id && inR(e.date));
      const petrol = sum(exp.filter((e) => e.category === 'Petrol'), (e) => e.amount); const maint = sum(exp.filter((e) => ['Service', 'Oil Change'].includes(e.category)), (e) => e.amount); const repair = sum(exp.filter((e) => e.category === 'Repair'), (e) => e.amount);
      const expenses = sum(exp, (e) => e.amount); return { id: c.id, car: c.name, plate: c.plate, bookings: bks.filter((b) => b.carId === c.id && b.status !== 'Cancelled' && inR(b.createdAt)).length, income, petrol, maint, repair, other: expenses - petrol - maint - repair, expenses, profit: income - expenses };
    });
    totals = { income: sum(rows, (r) => r.income), expenses: sum(rows, (r) => r.expenses), profit: sum(rows, (r) => r.profit) };
  }
  if (name === 'maintenance' || name === 'repairs') {
    const cats = name === 'repairs' ? ['Repair'] : ['Service', 'Oil Change'];
    rows = db.expenses.filter((e) => cats.includes(e.category) && inR(e.date) && inList(params.carId, e.carId)).map((e) => ({ id: e.id, date: e.date, car: m.car[e.carId]?.name, plate: m.car[e.carId]?.plate, category: e.category, details: e.details, supplier: e.supplier, amount: e.amount }));
    totals = { amount: sum(rows, (r) => r.amount) };
  }
  if (name === 'driver-bookings') rows = bks.filter((b) => b.driverId && inR(b.pickupAt) && inList(params.driverId, b.driverId) && inList(params.status, b.displayStatus)).map((b) => ({ id: b.id, driver: b.driverName, number: b.number, customer: b.customerName, car: b.carName, pickupAt: b.pickupAt, returnAt: b.returnAt, status: b.displayStatus }));
  if (params.search) { const q = params.search.toLowerCase(); rows = rows.filter((r) => Object.values(r).join(' ').toLowerCase().includes(q)); }
  const dflt = { 'cars-status': 'car:asc', customers: 'billed:desc', bookings: 'createdAt:desc', outstanding: 'balance:desc', maintenance: 'date:desc', repairs: 'date:desc', 'driver-bookings': 'pickupAt:desc', 'car-income': 'income:desc', 'car-expenses': 'expenses:desc', 'car-profit': 'profit:desc' }[name];
  return { ...paginate(sortRows(rows, params.sort, dflt), params), totals, name };
}
export const _unused = fmtDate;
