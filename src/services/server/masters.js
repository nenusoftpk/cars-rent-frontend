import { fail, guard, can, needAdmin, needFinancial, listify, inList, nextId, pushActivity, decoBookings, decoPayments, carStatus, findOverlap, maps, payAgg, scopedBookings, scopedCustomers, scopedPayments, maskCustomer, allRecords, localNow } from './core';
import { dayOf, toDay, parse, toLocalISO } from '@/lib/dates';
import { sum } from '@/lib/utils';
import { publicUser } from './auth';

const now = () => localNow();

function custStats(db, u) {
  const bks = decoBookings(db, scopedBookings(db, u)); const by = {};
  bks.forEach((b) => { if (b.status === 'Cancelled') return; const s = (by[b.customerId] ||= { totalBookings: 0, totalSpent: 0, pending: 0 }); s.totalBookings += 1; s.totalSpent += b.paid; s.pending += Math.max(b.balance, 0); });
  return by;
}

export function customerRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const id = segs[1];
  if (!id && method === 'GET') {
    guard(user, 'customers');
    const stats = custStats(db, user); const base = scopedCustomers(db, user);
    const all = base.map((c) => maskCustomer(user, { ...c, totalBookings: 0, totalSpent: 0, pending: 0, ...(stats[c.id] || {}) }));
    const month = toDay(now()).slice(0, 7);
    const summary = { total: all.length, active: all.filter((c) => c.status === 'Active').length, pending: all.filter((c) => c.pending > 0).length, newThisMonth: all.filter((c) => dayOf(c.createdAt).startsWith(month)).length };
    let rows = all.filter((c) => inList(params.status, c.status) && inList(params.city, c.city) && inList(params.type, c.type || 'None'));
    if (params.hasDues === 'true') rows = rows.filter((c) => c.pending > 0);
    return { ...listify(rows, params, { search: (c) => `${c.name} ${c.mobile} ${c.cnic} ${c.email}`, date: (c) => c.createdAt, defaultSort: 'createdAt:desc' }), summary };
  }
  if (!id && method === 'POST') {
    guard(user, 'customers', 'create');
    if (db.customers.some((c) => c.cnic === body.cnic)) fail(409, 'A customer with this CNIC already exists.');
    const c = { ...body, id: nextId(db, 'customer', 'cus'), status: 'Active', gender: 'm', email: body.email || '', openingBalance: 0, createdBy: user.id, createdAt: toLocalISO(new Date()), photo: body.photo || '/images/customers/c01.svg' };
    db.customers.unshift(c); pushActivity(db, 'customer', 'New Customer', `${c.name} registered`); return c;
  }
  const c = db.customers.find((x) => x.id === id); if (!c) fail(404, 'Customer not found.');
  if (method === 'GET') {
    guard(user, 'customers');
    if (!scopedCustomers(db, user).some((x) => x.id === id)) fail(403, 'This customer is not assigned to you.');
    const bks = decoBookings(db, scopedBookings(db, user).filter((b) => b.customerId === id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pays = decoPayments(db, scopedPayments(db, user).filter((p) => p.customerId === id)).sort((a, b) => b.date.localeCompare(a.date));
    const live = bks.filter((b) => b.status !== 'Cancelled');
    return { ...maskCustomer(user, c), bookings: bks, payments: pays, totalBookings: live.length, totalSpent: sum(live, (b) => b.paid), pending: sum(live, (b) => Math.max(b.balance, 0)) };
  }
  if (method === 'PUT') {
    guard(user, 'customers', 'edit');
    const patch = { ...body }; delete patch.id; delete patch.createdBy;
    if (!can(user, 'sensitive:view')) { delete patch.cnic; delete patch.licenseNo; delete patch.cnicFront; delete patch.cnicBack; delete patch.licenseImage; }
    if (patch.cnic && db.customers.some((x) => x.id !== id && x.cnic === patch.cnic)) fail(409, 'A customer with this CNIC already exists.');
    Object.assign(c, patch); return c;
  }
  if (method === 'DELETE') {
    guard(user, 'customers', 'delete');
    if (db.bookings.some((b) => b.customerId === id)) fail(409, 'This customer has bookings and cannot be deleted. Mark the customer as Inactive instead.');
    db.customers = db.customers.filter((x) => x.id !== id); return { ok: true };
  }
  fail(405, 'Not allowed');
}

export function carRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const id = segs[1];
  const deco = (c) => ({ ...c, manualStatus: c.status, status: carStatus(db, c, now()) });
  if (!id && method === 'GET') {
    guard(user, 'cars');
    const all = db.cars.map(deco);
    const summary = { total: all.length, available: all.filter((c) => c.status === 'Available').length, booked: all.filter((c) => c.status === 'Booked').length, onRent: all.filter((c) => c.status === 'On Rent').length, repair: all.filter((c) => c.status === 'Under Repair').length };
    let rows = all.filter((c) => inList(params.status, c.status) && inList(params.brand, c.brand) && inList(params.fuel, c.fuel));
    if (params.availFrom && params.availTo) rows = rows.map((c) => ({ ...c, freeForDates: c.manualStatus !== 'Under Repair' && !findOverlap(db, c.id, params.availFrom, params.availTo, params.excludeId, now()) }));
    return { ...listify(rows, params, { search: (c) => `${c.name} ${c.plate} ${c.brand} ${c.model}`, defaultSort: 'name:asc' }), summary };
  }
  if (!id && method === 'POST') {
    guard(user, 'cars', 'create');
    if (db.cars.some((c) => c.plate === body.plate)) fail(409, 'A car with this number plate already exists.');
    const c = { ...body, id: nextId(db, 'car', 'car'), name: `${body.brand} ${body.model}`, image: body.image || '/images/cars/toyota-corolla.svg', images: [body.image || '/images/cars/toyota-corolla.svg'], createdAt: toLocalISO(new Date()) };
    db.cars.push(c); pushActivity(db, 'booking', 'New Car', `${c.name} (${c.plate}) added`); return deco(c);
  }
  if (id === 'brands') return [...new Set(db.cars.map((c) => c.brand))];
  const car = db.cars.find((x) => x.id === id); if (!car) fail(404, 'Car not found.');
  if (segs[2] === 'services' && method === 'POST') {
    guard(user, 'cars', 'edit'); needFinancial(user);
    const e = { id: nextId(db, 'expense', 'exp'), date: body.date, category: body.category, details: body.details, carId: id, supplier: body.supplier || '', method: body.method, amount: Number(body.amount), createdBy: user.id };
    db.expenses.push(e);
    if (body.odometer) car.odometer = Math.max(car.odometer, Number(body.odometer));
    if (body.nextDue && body.category === 'Service') car.nextServiceDate = body.nextDue;
    if (body.nextDue && body.category === 'Oil Change') car.nextOilChangeDate = body.nextDue;
    return e;
  }
  if (method === 'GET') {
    guard(user, 'cars');
    const fin = can(user, 'financial:view');
    const hist = decoBookings(db, scopedBookings(db, user).filter((b) => b.carId === id)).sort((a, b) => b.pickupAt.localeCompare(a.pickupAt));
    const expenses = fin ? db.expenses.filter((e) => e.carId === id).sort((a, b) => b.date.localeCompare(a.date)) : [];
    return { ...deco(car), bookings: hist, expenses, financialLocked: !fin, totalIncome: fin ? sum(hist.filter((b) => b.status !== 'Cancelled'), (b) => b.paid) : null, totalExpenses: fin ? sum(expenses, (e) => e.amount) : null };
  }
  if (method === 'PUT') {
    guard(user, 'cars', 'edit');
    if (body.plate && db.cars.some((c) => c.id !== id && c.plate === body.plate)) fail(409, 'A car with this number plate already exists.');
    const patch = { ...body }; delete patch.id; delete patch.manualStatus;
    Object.assign(car, patch, { name: `${patch.brand || car.brand} ${patch.model || car.model}` });
    if (patch.image) car.images = [patch.image]; return deco(car);
  }
  if (method === 'DELETE') {
    guard(user, 'cars', 'delete');
    if (db.bookings.some((b) => b.carId === id)) fail(409, 'This car has booking history and cannot be deleted. Mark it as Under Repair instead.');
    db.cars = db.cars.filter((c) => c.id !== id); return { ok: true };
  }
  fail(405, 'Not allowed');
}

export function driverRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const id = segs[1];
  const counts = () => { const o = {}; db.bookings.forEach((b) => { if (b.driverId && b.status !== 'Cancelled') o[b.driverId] = (o[b.driverId] || 0) + 1; }); return o; };
  if (!id && method === 'GET') {
    guard(user, 'drivers'); const c = counts();
    const rows = db.drivers.map((d) => ({ ...d, assigned: c[d.id] || 0 })).filter((d) => inList(params.status, d.status));
    return { ...listify(rows, params, { search: (d) => `${d.name} ${d.mobile} ${d.licenseNo}`, defaultSort: 'name:asc' }), summary: { total: db.drivers.length, active: db.drivers.filter((d) => d.status === 'Active').length } };
  }
  if (!id && method === 'POST') { guard(user, 'drivers', 'create'); const d = { ...body, id: nextId(db, 'driver', 'd'), status: body.status || 'Active', photo: body.photo || '/images/drivers/d1.svg', createdAt: toLocalISO(new Date()) }; db.drivers.push(d); return d; }
  const d = db.drivers.find((x) => x.id === id); if (!d) fail(404, 'Driver not found.');
  if (method === 'GET') { guard(user, 'drivers'); return { ...d, bookings: decoBookings(db, scopedBookings(db, user).filter((b) => b.driverId === id)).sort((a, b) => b.pickupAt.localeCompare(a.pickupAt)) }; }
  if (method === 'PUT') { guard(user, 'drivers', 'edit'); Object.assign(d, body, { id }); return d; }
  if (method === 'DELETE') {
    guard(user, 'drivers', 'delete'); if (db.bookings.some((b) => b.driverId === id)) fail(409, 'This driver has bookings. Mark the driver as Inactive instead.');
    db.drivers = db.drivers.filter((x) => x.id !== id); return { ok: true };
  }
  fail(405, 'Not allowed');
}

export function staffRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const id = segs[1];
  if (id === 'options' && method === 'GET') return db.staff.filter((s) => s.status === 'Active').map((s) => ({ id: s.id, name: s.name, photo: s.photo, role: s.role }));
  if (!id && method === 'GET') {
    guard(user, 'staff');
    const rows = db.staff.map(publicUser).filter((s) => inList(params.role, s.role) && inList(params.status, s.status));
    return { ...listify(rows, params, { search: (s) => `${s.name} ${s.email} ${s.mobile}`, defaultSort: 'name:asc' }), summary: { total: db.staff.length, admins: db.staff.filter((s) => s.role === 'admin').length } };
  }
  needAdmin(user);
  if (!id && method === 'POST') {
    if (db.staff.some((s) => s.email.toLowerCase() === String(body.email).toLowerCase())) fail(409, 'An account with this email already exists.');
    if (!body.password || body.password.length < 6) fail(400, 'Please set a password of at least 6 characters.');
    const s = { ...body, id: nextId(db, 'staff', 's'), photo: body.photo || '/images/admins/e1.svg', createdAt: toLocalISO(new Date()) }; db.staff.push(s); return publicUser(s);
  }
  const s = db.staff.find((x) => x.id === id); if (!s) fail(404, 'User not found.');
  if (method === 'PUT') {
    if (s.id === user.id && body.role && body.role !== 'admin') fail(400, 'You cannot remove your own owner access.');
    const patch = { ...body }; if (!patch.password) delete patch.password; delete patch.id; Object.assign(s, patch); return publicUser(s);
  }
  if (method === 'DELETE') {
    if (s.id === user.id) fail(400, 'You cannot delete your own account.');
    db.staff = db.staff.filter((x) => x.id !== id); return { ok: true };
  }
  fail(405, 'Not allowed');
}
