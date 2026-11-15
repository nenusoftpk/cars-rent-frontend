import { addDays } from 'date-fns';
import { fail, guard, can, needAdmin, listify, inList, decoBookings, scopedBookings, scopedCustomers, carStatus, paginate, sortRows, localNow, maskCnic, nextId } from './core';
import { parse, dayOf, toDay, toLocalISO } from '@/lib/dates';
import { seedAll, DB_VERSION } from '@/mock';

// ---------- Reminders (built from live bookings + car dates) ----------
export function getReminders(db, user, now = localNow()) {
  const today = toDay(now); const out = []; const done = new Set(db.completedReminders);
  const add = (type, refId, carName, details, due, link) => {
    const id = `${type}:${refId}:${due}`; const completed = done.has(id); const d = dayOf(due);
    out.push({ id, type, details, car: carName, due, link, completed, view: completed ? 'Completed' : d < today ? 'Overdue' : d === today ? 'Today' : 'Upcoming' });
  };
  decoBookings(db, scopedBookings(db, user), now).filter((b) => b.status === 'On Rent').forEach((b) => {
    if (b.isOverdue) add('Overdue Car', b.id, b.carName, `${b.carName} (${b.carPlate}) - ${b.customerName} - ${b.customerMobile}`, b.returnAt, `/bookings/${b.id}`);
    else if (dayOf(b.returnAt) <= dayOf(addDays(now, 1))) add('Car Return', b.id, b.carName, `${b.carName} - ${b.customerName}`, b.returnAt, `/bookings/${b.id}`);
  });
  const horizon = dayOf(addDays(now, 45));
  db.cars.forEach((c) => {
    const tag = `${c.name} (${c.plate})`;
    [['Insurance Expiry', c.insuranceExpiry], ['Token Tax Expiry', c.tokenExpiry], ['Car Document Expiry', c.registrationExpiry], ['Car Servicing', c.nextServiceDate], ['Oil Change', c.nextOilChangeDate]].forEach(([t, d]) => { if (d && d <= horizon) add(t, c.id, c.name, tag, `${d}T09:00`, `/cars?view=${c.id}`); });
  });
  return out.sort((a, b) => a.due.localeCompare(b.due));
}
export function reminderRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const now = localNow();
  if (segs[0] === 'notifications') {
    const all = getReminders(db, user, now).filter((r) => !r.completed && ['Overdue', 'Today'].includes(r.view));
    return { count: all.length, items: all.slice(0, 8) };
  }
  guard(user, 'reminders');
  if (method === 'POST' && segs[1] === 'complete') { if (!db.completedReminders.includes(body.id)) db.completedReminders.push(body.id); return { ok: true }; }
  if (method === 'POST' && segs[1] === 'reopen') { db.completedReminders = db.completedReminders.filter((x) => x !== body.id); return { ok: true }; }
  const all = getReminders(db, user, now);
  const summary = { Today: 0, Upcoming: 0, Overdue: 0, Completed: 0 }; all.forEach((r) => { summary[r.view] += 1; });
  const rows = all.filter((r) => (params.view ? r.view === params.view : true) && inList(params.type, r.type));
  return { ...listify(rows, params, { search: (r) => `${r.type} ${r.details}`, defaultSort: 'due:asc' }), summary };
}

// ---------- Documents ----------
const FIELD = { customer: { 'Customer Photo': 'photo', 'CNIC Front': 'cnicFront', 'CNIC Back': 'cnicBack', 'Driving Licence': 'licenseImage' }, car: { 'Car Photo': 'image', 'Registration Document': 'registrationDoc', 'Insurance Document': 'insuranceDoc' } };
export function documentRoutes(ctx) {
  const { db, user, method, segs, params, body } = ctx; const id = segs[1];
  guard(user, 'documents', method === 'GET' ? 'view' : method === 'DELETE' ? 'delete' : 'create');
  const canSee = can(user, 'sensitive:view');
  const mask = (d) => (d.sensitive && !canSee ? { ...d, url: null, name: 'Hidden', locked: true } : d);
  if (method === 'GET') {
    const mine = new Set(scopedCustomers(db, user).map((c) => c.id)); const myB = new Set(scopedBookings(db, user).map((b) => b.id));
    let rows = db.documents.filter((d) => (d.ownerType === 'customer' ? mine.has(d.ownerId) : d.ownerType === 'booking' ? myB.has(d.ownerId) : true) && inList(params.type, d.type) && inList(params.ownerType, d.ownerType));
    const res = listify(rows.map(mask), params, { search: (d) => `${d.ownerName} ${d.type} ${d.name}`, date: (d) => d.uploadedAt, defaultSort: 'uploadedAt:desc' });
    return { ...res, summary: { total: rows.length, sensitive: rows.filter((d) => d.sensitive).length } };
  }
  if (method === 'POST') {
    if (!body.url) fail(400, 'Please choose a file.');
    const owner = body.ownerType === 'customer' ? db.customers.find((c) => c.id === body.ownerId) : db.cars.find((c) => c.id === body.ownerId);
    if (!owner) fail(400, 'Please select who this document belongs to.');
    const sensitive = ['CNIC Front', 'CNIC Back', 'Driving Licence'].includes(body.type);
    if (sensitive && !canSee) fail(403, 'You do not have permission to upload sensitive documents.');
    const ownerName = body.ownerType === 'customer' ? owner.name : `${owner.name} (${owner.plate})`;
    let d = db.documents.find((x) => x.ownerType === body.ownerType && x.ownerId === body.ownerId && x.type === body.type);
    const base = { name: body.name, url: body.url, mime: body.mime, size: body.size, uploadedAt: toLocalISO(new Date()) };
    if (d) Object.assign(d, base); else { d = { id: nextId(db, 'document', 'doc'), ownerType: body.ownerType, ownerId: body.ownerId, ownerName, type: body.type, sensitive, ...base }; db.documents.unshift(d); }
    const f = FIELD[body.ownerType]?.[body.type]; if (f) owner[f] = body.url; return d;
  }
  const d = db.documents.find((x) => x.id === id); if (!d) fail(404, 'Document not found.');
  if (d.sensitive && !canSee) fail(403, 'You do not have permission for this document.');
  if (method === 'PUT') {
    if (!body.url) fail(400, 'Please choose a file.'); Object.assign(d, { name: body.name, url: body.url, mime: body.mime, size: body.size, uploadedAt: toLocalISO(new Date()) });
    const owner = d.ownerType === 'customer' ? db.customers.find((c) => c.id === d.ownerId) : d.ownerType === 'car' ? db.cars.find((c) => c.id === d.ownerId) : null;
    const f = FIELD[d.ownerType]?.[d.type]; if (owner && f) owner[f] = body.url; return d;
  }
  if (method === 'DELETE') { db.documents = db.documents.filter((x) => x.id !== id); return { ok: true }; }
  fail(405, 'Not allowed');
}

// ---------- Settings / Backup / Sessions / Search / Reset ----------
export function systemRoutes(ctx) {
  const { db, user, adapter, method, segs, params, body } = ctx; const a = segs[0];
  if (a === 'settings') { if (method === 'GET') return db.settings; needAdmin(user); db.settings = { ...db.settings, ...body, currency: 'PKR' }; return db.settings; }
  if (a === 'sessions') {
    if (method === 'GET') return { items: db.sessions };
    if (method === 'DELETE') { const s = db.sessions.find((x) => x.id === segs[1]); if (s?.current) fail(400, 'You cannot sign out your current session here. Use Logout.'); db.sessions = db.sessions.filter((x) => x.id !== segs[1]); return { ok: true }; }
  }
  if (a === 'search') {
    const q = String(params.q || '').toLowerCase().trim(); if (q.length < 2) return { customers: [], cars: [], bookings: [] };
    const cs = can(user, 'customers:view') ? scopedCustomers(db, user).filter((c) => `${c.name} ${c.mobile}`.toLowerCase().includes(q)).slice(0, 4).map((c) => ({ id: c.id, title: c.name, sub: c.mobile, image: c.photo })) : [];
    const cars = can(user, 'cars:view') ? db.cars.filter((c) => `${c.name} ${c.plate}`.toLowerCase().includes(q)).slice(0, 4).map((c) => ({ id: c.id, title: c.name, sub: c.plate, image: c.image })) : [];
    const bks = can(user, 'bookings:view') ? decoBookings(db, scopedBookings(db, user)).filter((b) => `${b.number} ${b.invoiceNo} ${b.customerName}`.toLowerCase().includes(q)).slice(0, 4).map((b) => ({ id: b.id, title: b.number, sub: `${b.customerName} - ${b.carName}` })) : [];
    return { customers: cs, cars, bookings: bks };
  }
  // backup & security (owner only)
  guard(user, 'backup');
  if (a === 'backups') {
    if (segs[1] === 'export') { needAdmin(user); return { json: JSON.stringify(db) }; }
    if (segs[1] === 'log' && method === 'POST') { needAdmin(user); const e = { id: `bk-${Date.now()}`, at: toLocalISO(new Date()), type: 'Manual', size: `${(JSON.stringify(db).length / 1048576).toFixed(2)} MB`, status: 'Downloaded to this computer', note: 'Real file saved by you from this browser.' }; db.backups.unshift(e); return e; }
    if (segs[1] === 'restore' && method === 'POST') {
      needAdmin(user); let data; try { data = JSON.parse(body.json); } catch { fail(400, 'This file is not a valid backup.'); }
      if (!data || data.version !== DB_VERSION || !Array.isArray(data.customers) || !Array.isArray(data.bookings)) fail(400, 'This file is not a valid backup for this version of the software.');
      adapter.replace(data); return { ok: true, __replaced: true };
    }
    const real = db.backups.find((b) => b.status.startsWith('Downloaded'));
    return { items: db.backups, lastRealBackupAt: real?.at || null, records: { customers: db.customers.length, cars: db.cars.length, bookings: db.bookings.length, payments: db.payments.length }, storageKB: Math.round(JSON.stringify(db).length / 1024) };
  }
  if (a === 'system' && segs[1] === 'reset' && method === 'POST') { needAdmin(user); adapter.reset(); return { ok: true, __replaced: true }; }
  fail(404, 'Not found');
}
export const _x = [paginate, sortRows, carStatus, maskCnic, parse, addDays, seedAll];
