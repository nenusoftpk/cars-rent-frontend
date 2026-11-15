import { sleep } from '@/lib/utils';
import { fail } from './core';
import { authRoutes } from './auth';
import { customerRoutes, carRoutes, driverRoutes, staffRoutes } from './masters';
import { bookingRoutes } from './bookings';
import { paymentRoutes, incomeExpenseRoutes, ledgerRoutes, dashboardRoute, reportRoutes } from './finance';
import { reminderRoutes, documentRoutes, systemRoutes } from './system';

// A tiny in-browser "Express". It validates and enforces permissions the same way the real backend must.
export function createMockServer(adapter) {
  async function handle({ method = 'GET', url, params = {}, body = {} }) {
    await sleep(60 + Math.random() * 120);
    const db = adapter.load();
    const session = adapter.getSession();
    const user = session ? db.staff.find((s) => s.id === session.userId && s.status === 'Active') || null : null;
    const segs = url.split('/').filter(Boolean);
    const ctx = { db, user, adapter, method, segs, params, body };
    let out;
    if (segs[0] === 'auth') out = authRoutes(ctx);
    else {
      if (!user) fail(401, 'Your session has expired. Please log in again.');
      switch (segs[0]) {
        case 'dashboard': out = dashboardRoute(ctx); break;
        case 'customers': out = customerRoutes(ctx); break;
        case 'cars': out = carRoutes(ctx); break;
        case 'drivers': out = driverRoutes(ctx); break;
        case 'staff': out = staffRoutes(ctx); break;
        case 'bookings': out = bookingRoutes(ctx); break;
        case 'payments': case 'invoices': case 'deposits': out = paymentRoutes(ctx); break;
        case 'expenses': case 'income-expenses': out = incomeExpenseRoutes(ctx); break;
        case 'ledger': out = ledgerRoutes(ctx); break;
        case 'reports': out = reportRoutes(ctx); break;
        case 'reminders': case 'notifications': out = reminderRoutes(ctx); break;
        case 'documents': out = documentRoutes(ctx); break;
        default: out = systemRoutes(ctx);
      }
    }
    if (method !== 'GET' && !out?.__replaced) adapter.save(db);
    return out;
  }
  return { handle };
}
