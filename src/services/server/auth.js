import { fail, nextId, pushActivity } from './core';
import { EMPLOYEE_DEFAULT } from '@/constants/permissions';
import { toLocalISO } from '@/lib/dates';

const pub = ({ password, ...u }) => u;
export function authRoutes({ db, adapter, method, segs, body, user }) {
  const a = segs[1];
  if (method === 'POST' && a === 'login') {
    const id = String(body.email || '').trim().toLowerCase();
    const u = db.staff.find((s) => (s.email.toLowerCase() === id || s.email.split('@')[0].toLowerCase() === id) && s.password === body.password);
    if (!u) fail(401, 'Wrong email or password. Please try again.');
    if (u.status !== 'Active') fail(403, 'This account is switched off. Please contact the owner.');
    adapter.setSession({ userId: u.id, token: `mock.${u.id}` });
    db.sessions.unshift({ id: `ses-${Date.now()}`, device: 'This browser', place: 'Lahore, Pakistan', at: toLocalISO(new Date()), current: true });
    db.sessions = db.sessions.slice(0, 8).map((s, i) => ({ ...s, current: i === 0 }));
    adapter.save(db);
    return { token: `mock.${u.id}`, user: pub(u) };
  }
  if (method === 'POST' && a === 'signup') {
    if (db.staff.some((s) => s.email.toLowerCase() === String(body.email).toLowerCase())) fail(409, 'An account with this email already exists.');
    const id = nextId(db, 'staff', 's');
    const u = { id, name: body.name, email: body.email, mobile: body.mobile, password: body.password, role: body.role === 'admin' ? 'admin' : 'employee', permissions: [...EMPLOYEE_DEFAULT], photo: '/images/admins/e1.svg', status: 'Active', createdAt: toLocalISO(new Date()) };
    db.staff.push(u); pushActivity(db, 'customer', 'New Account', `${u.name} signed up`);
    adapter.setSession({ userId: id, token: `mock.${id}` }); adapter.save(db);
    return { token: `mock.${id}`, user: pub(u) };
  }
  if (!user) fail(401, 'Your session has expired. Please log in again.');
  if (method === 'GET' && a === 'me') return pub(user);
  if (method === 'POST' && a === 'logout') { adapter.clearSession(); return { ok: true }; }
  if (method === 'POST' && a === 'change-password') {
    if (user.password !== body.current) fail(400, 'Your current password is not correct.');
    user.password = body.next; return { ok: true };
  }
  fail(404, 'Not found');
}
export { pub as publicUser };
